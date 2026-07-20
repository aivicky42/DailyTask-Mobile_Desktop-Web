import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Bell, Repeat, ChevronDown } from 'lucide-react';
import { cn, formatDateISO } from '../lib/utils';
import {
  getCategories,
  getSettings,
  createTaskOccurrence,
  updateTaskOccurrence,
  createTaskTemplate,
  updateTaskTemplate,
  checkConflict,
  generateToday,
} from '../api/client';
import ConflictDialog from './ConflictDialog';
import RecurrencePrompt from './RecurrencePrompt';
import type {
  TaskOccurrence,
  Category,
  RecurrenceType,
  RecurrenceInterval,
  ConflictCheck,
  DeleteScope,
} from '../types';

interface TaskFormData {
  title: string;
  description: string;
  date: string;
  start_time: string;
  duration_hours: number;
  duration_minutes: number;
  category_id: string;
  reminder_enabled: boolean;
  recurrence_type: RecurrenceType;
  recurrence_interval: RecurrenceInterval;
  custom_days: number[];    // 0=Sun … 6=Sat
  due_date: string;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const RECURRENCE_OPTIONS: { value: RecurrenceType; label: string }[] = [
  { value: 'NONE', label: 'Does not repeat' },
  { value: 'DAILY', label: 'Daily' },
  { value: 'RECURRING', label: 'Recurring (interval)' },
  { value: 'CUSTOM', label: 'Custom (specific days)' },
];

const INTERVAL_OPTIONS: { value: RecurrenceInterval; label: string }[] = [
  { value: 'DAILY', label: 'Every day' },
  { value: 'WEEKLY', label: 'Every week' },
  { value: 'MONTHLY', label: 'Every month' },
  { value: 'YEARLY', label: 'Every year' },
];

interface TaskModalProps {
  task?: TaskOccurrence;        // defined when editing
  initialDate?: string;         // pre-fill date
  onClose: () => void;
  onSuccess: () => void;
}

export default function TaskModal({ task, initialDate, onClose, onSuccess }: TaskModalProps) {
  const qc = useQueryClient();

  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: getCategories });
  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: getSettings });

  // ── Form state ──────────────────────────────────────────────────────
  const defaultDuration = settings?.default_duration ?? 60;
  const defaultCategoryId = categories[0]?.id ?? '';

  const [form, setForm] = useState<TaskFormData>(() => {
    if (task) {
      return {
        title: task.title,
        description: task.description ?? '',
        date: task.date,
        start_time: task.start_time.slice(0, 5),
        duration_hours: Math.floor(task.time_to_complete / 60),
        duration_minutes: task.time_to_complete % 60,
        category_id: task.category_id,
        reminder_enabled: task.reminder_enabled,
        recurrence_type: 'NONE',
        recurrence_interval: 'WEEKLY',
        custom_days: [],
        due_date: '',
      };
    }
    return {
      title: '',
      description: '',
      date: initialDate ?? formatDateISO(new Date()),
      start_time: '09:00',
      duration_hours: Math.floor(defaultDuration / 60),
      duration_minutes: defaultDuration % 60,
      category_id: defaultCategoryId,
      reminder_enabled: false,
      recurrence_type: 'NONE',
      recurrence_interval: 'WEEKLY',
      custom_days: [],
      due_date: '',
    };
  });

  // Sync default category once loaded
  useEffect(() => {
    if (!task && !form.category_id && categories.length > 0) {
      setForm((f) => ({ ...f, category_id: categories[0].id }));
    }
  }, [categories, task, form.category_id]);

  // ── Dialog state ────────────────────────────────────────────────────
  const [conflict, setConflict] = useState<ConflictCheck | null>(null);
  const [showRecurrencePrompt, setShowRecurrencePrompt] = useState(false);
  const [pendingScope, setPendingScope] = useState<DeleteScope | null>(null);
  const [pendingDateRange, setPendingDateRange] = useState<{ start: string; end: string } | undefined>();
  const [errors, setErrors] = useState<Partial<Record<keyof TaskFormData, string>>>({});

  // ── Derived ─────────────────────────────────────────────────────────
  const timeToComplete = form.duration_hours * 60 + form.duration_minutes;
  const isEditing = Boolean(task);
  const isRecurringEdit = isEditing && Boolean(task?.task_template_id);

  // ── Mutation helpers ────────────────────────────────────────────────
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['task-occurrences'] });
    qc.invalidateQueries({ queryKey: ['task-templates'] });
  };

  const createOccurrenceMut = useMutation({
    mutationFn: createTaskOccurrence,
    onSuccess: () => { invalidate(); onSuccess(); },
  });

  const updateOccurrenceMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updateTaskOccurrence>[1] }) =>
      updateTaskOccurrence(id, data),
    onSuccess: () => { invalidate(); onSuccess(); },
  });

  const createTemplateMut = useMutation({
    mutationFn: createTaskTemplate,
    onSuccess: async () => {
      // Immediately generate today's occurrence so the task appears right away
      try { await generateToday(); } catch { /* non-critical */ }
      invalidate();
      onSuccess();
    },
  });

  const updateTemplateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updateTaskTemplate>[1] }) =>
      updateTaskTemplate(id, data),
    onSuccess: () => { invalidate(); onSuccess(); },
  });

  const isSaving =
    createOccurrenceMut.isPending ||
    updateOccurrenceMut.isPending ||
    createTemplateMut.isPending ||
    updateTemplateMut.isPending;

  // ── Validation ──────────────────────────────────────────────────────
  const validate = (): boolean => {
    const e: typeof errors = {};
    if (!form.title.trim()) e.title = 'Title is required';
    if (!form.date) e.date = 'Date is required';
    if (!form.start_time) e.start_time = 'Start time is required';
    if (timeToComplete <= 0) e.duration_hours = 'Duration must be > 0';
    if (!form.category_id) e.category_id = 'Category is required';
    // CUSTOM is valid with EITHER specific weekdays OR a due date (persistent carry-forward)
    if (form.recurrence_type === 'CUSTOM' && form.custom_days.length === 0 && !form.due_date) {
      e.custom_days = 'Select at least one weekday, or assign a due date';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Save logic ──────────────────────────────────────────────────────
  const buildOccurrencePayload = () => ({
    date: form.date,
    title: form.title.trim(),
    description: form.description.trim() || null,
    category_id: form.category_id,
    start_time: form.start_time,
    time_to_complete: timeToComplete,
    reminder_enabled: form.reminder_enabled,
    status: task?.status ?? 'TODO' as const,
    elapsed_time: task?.elapsed_time ?? 0,
  });

  const buildTemplatePayload = () => ({
    category_id: form.category_id,
    title: form.title.trim(),
    description: form.description.trim() || null,
    start_date: form.date,
    due_date: form.due_date || null,
    start_time: form.start_time,
    time_to_complete: timeToComplete,
    reminder_enabled: form.reminder_enabled,
    recurrence_type: form.recurrence_type,
    recurrence_interval: form.recurrence_type === 'RECURRING' ? form.recurrence_interval : null,
    // Scheduler expects comma-separated string: 'Mon,Wed,Fri'
    custom_days: form.recurrence_type === 'CUSTOM' && form.custom_days.length > 0
      ? form.custom_days.join(',')
      : null,
  });

  const doSave = (scope?: DeleteScope, dateRange?: { start: string; end: string }) => {
    if (form.recurrence_type === 'NONE') {
      if (isEditing && task) {
        if (isRecurringEdit && scope === 'ALL_RECURRING' && task.task_template_id) {
          // Edit the template
          updateTemplateMut.mutate({ id: task.task_template_id, data: buildTemplatePayload() });
        } else {
          // Edit single occurrence (detach if was recurring)
          updateOccurrenceMut.mutate({
            id: task.id,
            data: {
              ...buildOccurrencePayload(),
              is_detached: isRecurringEdit ? true : undefined,
            },
          });
        }
      } else {
        createOccurrenceMut.mutate(buildOccurrencePayload());
      }
    } else {
      // Recurring
      if (isEditing && task?.task_template_id) {
        updateTemplateMut.mutate({ id: task.task_template_id, data: buildTemplatePayload() });
      } else {
        createTemplateMut.mutate(buildTemplatePayload());
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    // If editing a recurring task, prompt for scope first
    if (isRecurringEdit && !pendingScope) {
      setShowRecurrencePrompt(true);
      return;
    }

    // Check conflicts
    try {
      const result = await checkConflict({
        date: form.date,
        start_time: form.start_time,
        time_to_complete: timeToComplete,
        exclude_id: task?.id,
      });
      if (result.has_conflict) {
        setConflict(result);
        return;
      }
    } catch {
      // If conflict check fails, proceed anyway
    }

    doSave(pendingScope ?? undefined, pendingDateRange);
  };

  const handleRecurrenceScope = (scope: DeleteScope, dateRange?: { start: string; end: string }) => {
    setPendingScope(scope);
    setPendingDateRange(dateRange);
    setShowRecurrencePrompt(false);
    // Re-trigger submit with scope set
    handleSubmitAfterScope(scope, dateRange);
  };

  const handleSubmitAfterScope = async (scope: DeleteScope, dateRange?: { start: string; end: string }) => {
    try {
      const result = await checkConflict({
        date: form.date,
        start_time: form.start_time,
        time_to_complete: timeToComplete,
        exclude_id: task?.id,
      });
      if (result.has_conflict) {
        setConflict(result);
        return;
      }
    } catch { /* proceed */ }
    doSave(scope, dateRange);
  };

  const update = <K extends keyof TaskFormData>(key: K, value: TaskFormData[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const toggleCustomDay = (day: number) => {
    setForm((f) => ({
      ...f,
      custom_days: f.custom_days.includes(day)
        ? f.custom_days.filter((d) => d !== day)
        : [...f.custom_days, day],
    }));
    if (errors.custom_days) setErrors((e) => ({ ...e, custom_days: undefined }));
  };

  // ── Input class helper ──────────────────────────────────────────────
  const inputCls = (hasError?: boolean) =>
    cn(
      'w-full px-3 py-2.5 text-sm rounded-xl border bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors',
      hasError
        ? 'border-red-300 dark:border-red-600 focus:border-red-400'
        : 'border-gray-200 dark:border-gray-600 focus:border-primary',
    );

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center p-0 sm:p-4">
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

        {/* Modal */}
        <div className="relative bg-white dark:bg-gray-800 w-full sm:max-w-xl rounded-t-2xl sm:rounded-2xl shadow-2xl z-10 flex flex-col max-h-[92dvh]">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {isEditing ? 'Edit Task' : 'New Task'}
            </h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              {/* Title */}
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                  Title <span className="text-red-400">*</span>
                </label>
                <input
                  value={form.title}
                  onChange={(e) => update('title', e.target.value)}
                  placeholder="What do you need to do?"
                  className={inputCls(Boolean(errors.title))}
                  autoFocus
                />
                {errors.title && <p className="mt-1 text-xs text-red-500">{errors.title}</p>}
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => update('description', e.target.value)}
                  placeholder="Add notes or details..."
                  rows={2}
                  className={cn(inputCls(), 'resize-none')}
                />
              </div>

              {/* Date + Start Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                    Date <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => update('date', e.target.value)}
                    className={inputCls(Boolean(errors.date))}
                  />
                  {errors.date && <p className="mt-1 text-xs text-red-500">{errors.date}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                    Start Time <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="time"
                    value={form.start_time}
                    onChange={(e) => update('start_time', e.target.value)}
                    className={inputCls(Boolean(errors.start_time))}
                  />
                </div>
              </div>

              {/* Duration */}
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                  Duration
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="number"
                      min={0}
                      max={23}
                      value={form.duration_hours}
                      onChange={(e) => update('duration_hours', Math.max(0, parseInt(e.target.value) || 0))}
                      className={cn(inputCls(Boolean(errors.duration_hours)), 'text-center')}
                    />
                    <span className="text-sm text-gray-500 flex-shrink-0">h</span>
                  </div>
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="number"
                      min={0}
                      max={59}
                      step={5}
                      value={form.duration_minutes}
                      onChange={(e) => update('duration_minutes', Math.max(0, parseInt(e.target.value) || 0))}
                      className={cn(inputCls(), 'text-center')}
                    />
                    <span className="text-sm text-gray-500 flex-shrink-0">m</span>
                  </div>
                </div>
                {errors.duration_hours && (
                  <p className="mt-1 text-xs text-red-500">{errors.duration_hours}</p>
                )}
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                  Category
                </label>
                <div className="relative">
                  <select
                    value={form.category_id}
                    onChange={(e) => update('category_id', e.target.value)}
                    className={cn(inputCls(Boolean(errors.category_id)), 'appearance-none pr-8 cursor-pointer')}
                  >
                    <option value="">Select category...</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.icon_path} {c.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={14}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                  />
                </div>
              </div>

              {/* Reminder toggle */}
              <div className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2.5">
                  <Bell size={16} className="text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Reminder</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      {settings?.default_reminder ?? 15} min before
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => update('reminder_enabled', !form.reminder_enabled)}
                  className={cn(
                    'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                    form.reminder_enabled ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-600',
                  )}
                  role="switch"
                  aria-checked={form.reminder_enabled}
                >
                  <span
                    className={cn(
                      'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
                      form.reminder_enabled ? 'translate-x-6' : 'translate-x-1',
                    )}
                  />
                </button>
              </div>

              {/* Recurrence */}
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                  <Repeat size={12} className="inline mr-1" />
                  Repeat
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {RECURRENCE_OPTIONS.map((opt) => (
                    <label
                      key={opt.value}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2.5 rounded-xl border cursor-pointer text-sm transition-colors',
                        form.recurrence_type === opt.value
                          ? 'border-primary bg-primary/5 dark:bg-primary/10 text-primary'
                          : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500',
                      )}
                    >
                      <input
                        type="radio"
                        name="recurrence_type"
                        value={opt.value}
                        checked={form.recurrence_type === opt.value}
                        onChange={() => update('recurrence_type', opt.value)}
                        className="sr-only"
                      />
                      <span
                        className={cn(
                          'w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 flex items-center justify-center',
                          form.recurrence_type === opt.value
                            ? 'border-primary'
                            : 'border-gray-300 dark:border-gray-500',
                        )}
                      >
                        {form.recurrence_type === opt.value && (
                          <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                        )}
                      </span>
                      {opt.label}
                    </label>
                  ))}
                </div>

                {/* Interval selector */}
                {form.recurrence_type === 'RECURRING' && (
                  <div className="mt-3">
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                      Repeat every
                    </label>
                    <div className="relative">
                      <select
                        value={form.recurrence_interval}
                        onChange={(e) => update('recurrence_interval', e.target.value as RecurrenceInterval)}
                        className={cn(inputCls(), 'appearance-none pr-8 cursor-pointer')}
                      >
                        {INTERVAL_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                      <ChevronDown
                        size={14}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                      />
                    </div>
                  </div>
                )}

                {/* Custom days */}
                {form.recurrence_type === 'CUSTOM' && (
                  <div className="mt-3 space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                        Repeat on
                      </label>
                      <div className="flex gap-1.5 flex-wrap">
                        {DAY_NAMES.map((name, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => toggleCustomDay(idx)}
                            className={cn(
                              'w-10 h-10 rounded-xl text-xs font-medium transition-colors',
                              form.custom_days.includes(idx)
                                ? 'bg-primary text-white'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600',
                            )}
                          >
                            {name}
                          </button>
                        ))}
                      </div>
                      {errors.custom_days && (
                        <p className="mt-1 text-xs text-red-500">{errors.custom_days}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                        End date (optional)
                      </label>
                      <input
                        type="date"
                        value={form.due_date}
                        min={form.date}
                        onChange={(e) => update('due_date', e.target.value)}
                        className={inputCls()}
                      />
                    </div>
                  </div>
                )}

                {/* Due date for DAILY */}
                {form.recurrence_type === 'DAILY' && (
                  <div className="mt-3">
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                      End date (optional)
                    </label>
                    <input
                      type="date"
                      value={form.due_date}
                      min={form.date}
                      onChange={(e) => update('due_date', e.target.value)}
                      className={inputCls()}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-3 px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex-shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="flex-1 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-600 text-white text-sm font-medium transition-colors disabled:opacity-60"
              >
                {isSaving ? 'Saving…' : isEditing ? 'Save Changes' : 'Create Task'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Conflict dialog */}
      {conflict && (
        <ConflictDialog
          conflict={conflict}
          onOverride={() => {
            setConflict(null);
            doSave(pendingScope ?? undefined, pendingDateRange);
          }}
          onReschedule={() => setConflict(null)}
          onClose={() => setConflict(null)}
        />
      )}

      {/* Recurrence scope prompt (for editing recurring tasks) */}
      <RecurrencePrompt
        isOpen={showRecurrencePrompt}
        action="edit"
        taskTitle={task?.title ?? ''}
        onClose={() => setShowRecurrencePrompt(false)}
        onConfirm={handleRecurrenceScope}
      />
    </>
  );
}
