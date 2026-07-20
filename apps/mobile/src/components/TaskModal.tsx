import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
  ActivityIndicator,
  Platform,
  Modal,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';

import {
  TaskOccurrence,
  Category,
  RecurrenceType,
  RecurrenceInterval,
  ConflictCheck,
  DeleteScope,
} from '../types';
import { COLORS } from '../constants/colors';
import { useAppTheme } from '../hooks/useAppTheme';
import ConflictDialog from './ConflictDialog';
import RecurrencePrompt from './RecurrencePrompt';
import {
  createTaskOccurrence,
  updateTaskOccurrence,
  checkConflict,
  getCategories,
  scheduleTaskReminder,
  getSettings,
} from '../api/client';
import {
  toDateString,
  toTimeString,
  formatDate,
  formatTimeDisplay,
  parseTimeString,
} from '../lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FormState {
  title: string;
  description: string;
  date: Date;
  startTimeHours: number;
  startTimeMinutes: number;
  durationHours: number;
  durationMinutes: number;
  categoryId: string;
  reminderEnabled: boolean;
  recurrenceType: RecurrenceType;
  recurrenceInterval: RecurrenceInterval;
  customDays: string[];
  dueDate: Date | null;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  task?: TaskOccurrence | null;
  defaultDate?: Date;
  queryKey: unknown[];
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const WEEKDAY_VALUES = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

const RECURRENCE_OPTIONS: { value: RecurrenceType; label: string; icon: string }[] = [
  { value: 'NONE', label: 'One-time', icon: '1️⃣' },
  { value: 'DAILY', label: 'Daily', icon: '📅' },
  { value: 'RECURRING', label: 'Recurring', icon: '🔄' },
  { value: 'CUSTOM', label: 'Custom', icon: '✏️' },
];

const INTERVAL_OPTIONS: { value: RecurrenceInterval; label: string }[] = [
  { value: 'DAILY', label: 'Daily' },
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'YEARLY', label: 'Yearly' },
];

function defaultForm(defaultDate?: Date, defaultDuration = 30): FormState {
  const now = new Date();
  return {
    title: '',
    description: '',
    date: defaultDate ?? now,
    startTimeHours: now.getHours(),
    startTimeMinutes: Math.ceil(now.getMinutes() / 15) * 15,
    durationHours: Math.floor(defaultDuration / 60),
    durationMinutes: defaultDuration % 60,
    categoryId: '',
    reminderEnabled: false,
    recurrenceType: 'NONE',
    recurrenceInterval: 'WEEKLY',
    customDays: [],
    dueDate: null,
  };
}

export default function TaskModal({ visible, onClose, task, defaultDate, queryKey }: Props) {
  const theme = useAppTheme();
  const queryClient = useQueryClient();

  const [form, setForm] = useState<FormState>(() => defaultForm(defaultDate));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showDueDatePicker, setShowDueDatePicker] = useState(false);
  const [conflict, setConflict] = useState<ConflictCheck | null>(null);
  const [showConflict, setShowConflict] = useState(false);
  const [showRecurrencePrompt, setShowRecurrencePrompt] = useState(false);
  const [pendingSave, setPendingSave] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // ── Data ────────────────────────────────────────────────────────────────────

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: getCategories,
  });

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: getSettings,
  });

  // ── Initialize form from task or defaults ────────────────────────────────

  useEffect(() => {
    if (!visible) return;

    if (task) {
      const { hours, minutes } = parseTimeString(task.start_time);
      setForm({
        title: task.title,
        description: task.description ?? '',
        date: new Date(task.date),
        startTimeHours: hours,
        startTimeMinutes: minutes,
        durationHours: Math.floor(task.time_to_complete / 3600),
        durationMinutes: Math.floor((task.time_to_complete % 3600) / 60),
        categoryId: task.category_id,
        reminderEnabled: task.reminder_enabled,
        recurrenceType: 'NONE',
        recurrenceInterval: 'WEEKLY',
        customDays: [],
        dueDate: null,
      });
    } else {
      const defDuration = settings?.default_duration ?? 30;
      setForm(defaultForm(defaultDate, defDuration));
      if (categories.length > 0 && !form.categoryId) {
        setForm((prev) => ({ ...prev, categoryId: categories[0]!.id }));
      }
    }
  }, [visible, task]);

  // Auto-select first category
  useEffect(() => {
    if (categories.length > 0 && !form.categoryId && !task) {
      setForm((prev) => ({ ...prev, categoryId: categories[0]!.id }));
    }
  }, [categories]);

  // ── Computed ────────────────────────────────────────────────────────────────

  const startTimeStr = toTimeString(form.startTimeHours, form.startTimeMinutes);
  const durationSeconds = form.durationHours * 3600 + form.durationMinutes * 60;
  const dateStr = toDateString(form.date);

  // ── Mutations ───────────────────────────────────────────────────────────────

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const doSave = useCallback(
    async (overrideConflict = false) => {
      if (isSaving) return;
      setIsSaving(true);
      try {
        const payload = {
          title: form.title.trim(),
          description: form.description.trim() || undefined,
          date: dateStr,
          start_time: startTimeStr,
          time_to_complete: durationSeconds,
          category_id: form.categoryId,
          reminder_enabled: form.reminderEnabled,
          recurrence_type: form.recurrenceType,
          recurrence_interval:
            form.recurrenceType === 'RECURRING' ? form.recurrenceInterval : undefined,
          custom_days:
            form.recurrenceType === 'CUSTOM' ? form.customDays.join(',') : undefined,
          due_date: form.dueDate ? toDateString(form.dueDate) : undefined,
        };

        let saved: TaskOccurrence;
        if (task) {
          saved = await updateTaskOccurrence(task.id, payload);
        } else {
          saved = await createTaskOccurrence(payload);
        }

        // Schedule reminder if enabled
        if (form.reminderEnabled && settings?.default_reminder) {
          await scheduleTaskReminder(saved, settings.default_reminder);
        }

        invalidate();
        onClose();
      } catch (e: any) {
        Alert.alert('Error', e?.message ?? 'Failed to save task.');
      } finally {
        setIsSaving(false);
      }
    },
    [form, task, dateStr, startTimeStr, durationSeconds, settings, invalidate, onClose, isSaving]
  );

  const handleSave = useCallback(async () => {
    if (!form.title.trim()) {
      Alert.alert('Validation', 'Task title is required.');
      return;
    }
    if (!form.categoryId) {
      Alert.alert('Validation', 'Please select a category.');
      return;
    }
    if (durationSeconds === 0) {
      Alert.alert('Validation', 'Duration must be greater than 0.');
      return;
    }

    // For edits on recurring tasks, prompt scope first
    if (task?.task_template_id) {
      setShowRecurrencePrompt(true);
      return;
    }

    // Check conflict
    try {
      const result = await checkConflict({
        date: dateStr,
        start_time: startTimeStr,
        time_to_complete: durationSeconds,
        exclude_id: task?.id,
      });
      if (result.has_conflict) {
        setConflict(result);
        setShowConflict(true);
        return;
      }
    } catch {
      // Continue if conflict check fails
    }

    await doSave();
  }, [form, task, dateStr, startTimeStr, durationSeconds, doSave]);

  const handleRecurrenceScope = useCallback(
    async (scope: DeleteScope, _endDate?: string) => {
      setShowRecurrencePrompt(false);
      // Check conflict then save
      try {
        const result = await checkConflict({
          date: dateStr,
          start_time: startTimeStr,
          time_to_complete: durationSeconds,
          exclude_id: task?.id,
        });
        if (result.has_conflict) {
          setConflict(result);
          setShowConflict(true);
          return;
        }
      } catch {}
      await doSave();
    },
    [dateStr, startTimeStr, durationSeconds, task, doSave]
  );

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const toggleCustomDay = (day: string) => {
    setForm((prev) => ({
      ...prev,
      customDays: prev.customDays.includes(day)
        ? prev.customDays.filter((d) => d !== day)
        : [...prev.customDays, day],
    }));
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={onClose}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableWithoutFeedback onPress={onClose}>
            <View style={styles.backdrop}>
              <TouchableWithoutFeedback>
                <View style={[styles.sheet, { backgroundColor: theme.surface }]}>
                  {/* Handle */}
                  <View style={[styles.handle, { backgroundColor: theme.border }]} />

                  {/* Header */}
                  <View style={styles.sheetHeader}>
                    <Text style={[styles.sheetTitle, { color: theme.text }]}>
                      {task ? 'Edit Task' : 'New Task'}
                    </Text>
                    <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                      <Text style={[styles.closeBtnText, { color: theme.textSecondary }]}>✕</Text>
                    </TouchableOpacity>
                  </View>

                  <ScrollView
                    style={styles.scroll}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                  >
                    {/* ── Title ─────────────────────────────────────────── */}
                    <Field label="Title *">
                      <TextInput
                        style={[
                          styles.input,
                          { backgroundColor: theme.background, borderColor: theme.border, color: theme.text },
                        ]}
                        value={form.title}
                        onChangeText={(v) => setForm((p) => ({ ...p, title: v }))}
                        placeholder="What do you need to do?"
                        placeholderTextColor={theme.textMuted}
                        maxLength={120}
                        returnKeyType="next"
                      />
                    </Field>

                    {/* ── Description ───────────────────────────────────── */}
                    <Field label="Description">
                      <TextInput
                        style={[
                          styles.input,
                          styles.multiline,
                          { backgroundColor: theme.background, borderColor: theme.border, color: theme.text },
                        ]}
                        value={form.description}
                        onChangeText={(v) => setForm((p) => ({ ...p, description: v }))}
                        placeholder="Add details (optional)"
                        placeholderTextColor={theme.textMuted}
                        multiline
                        numberOfLines={3}
                        textAlignVertical="top"
                        maxLength={500}
                      />
                    </Field>

                    {/* ── Date & Time row ───────────────────────────────── */}
                    <View style={styles.row2}>
                      <Field label="Date" style={{ flex: 1 }}>
                        <TouchableOpacity
                          style={[styles.pickerBtn, { backgroundColor: theme.background, borderColor: theme.border }]}
                          onPress={() => setShowDatePicker(true)}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.pickerBtnIcon}>📅</Text>
                          <Text style={[styles.pickerBtnText, { color: theme.text }]}>
                            {formatDate(dateStr)}
                          </Text>
                        </TouchableOpacity>
                      </Field>

                      <Field label="Start Time" style={{ flex: 1 }}>
                        <TouchableOpacity
                          style={[styles.pickerBtn, { backgroundColor: theme.background, borderColor: theme.border }]}
                          onPress={() => setShowTimePicker(true)}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.pickerBtnIcon}>🕐</Text>
                          <Text style={[styles.pickerBtnText, { color: theme.text }]}>
                            {formatTimeDisplay(startTimeStr)}
                          </Text>
                        </TouchableOpacity>
                      </Field>
                    </View>

                    {/* DateTimePicker modals */}
                    {showDatePicker && (
                      <DateTimePicker
                        value={form.date}
                        mode="date"
                        onChange={(_, date) => {
                          setShowDatePicker(false);
                          if (date) setForm((p) => ({ ...p, date }));
                        }}
                      />
                    )}
                    {showTimePicker && (
                      <DateTimePicker
                        value={(() => {
                          const d = new Date();
                          d.setHours(form.startTimeHours, form.startTimeMinutes, 0, 0);
                          return d;
                        })()}
                        mode="time"
                        is24Hour={false}
                        onChange={(_, date) => {
                          setShowTimePicker(false);
                          if (date) {
                            setForm((p) => ({
                              ...p,
                              startTimeHours: date.getHours(),
                              startTimeMinutes: date.getMinutes(),
                            }));
                          }
                        }}
                      />
                    )}

                    {/* ── Duration ─────────────────────────────────────── */}
                    <Field label="Duration">
                      <View style={styles.durationRow}>
                        <DurationInput
                          value={form.durationHours}
                          onChange={(v) => setForm((p) => ({ ...p, durationHours: v }))}
                          max={23}
                          label="h"
                          theme={theme}
                        />
                        <Text style={[styles.durationSep, { color: theme.textMuted }]}>:</Text>
                        <DurationInput
                          value={form.durationMinutes}
                          onChange={(v) => setForm((p) => ({ ...p, durationMinutes: v }))}
                          max={59}
                          label="m"
                          theme={theme}
                          step={5}
                        />
                      </View>
                    </Field>

                    {/* ── Category ─────────────────────────────────────── */}
                    <Field label="Category">
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <View style={styles.categoryRow}>
                          {categories.map((cat) => {
                            const isSelected = form.categoryId === cat.id;
                            const color = cat.color_hex || COLORS.primary;
                            return (
                              <TouchableOpacity
                                key={cat.id}
                                style={[
                                  styles.categoryChip,
                                  {
                                    backgroundColor: isSelected ? color : `${color}15`,
                                    borderColor: isSelected ? color : 'transparent',
                                    borderWidth: 1.5,
                                  },
                                ]}
                                onPress={() => setForm((p) => ({ ...p, categoryId: cat.id }))}
                                activeOpacity={0.8}
                              >
                                <Text style={styles.categoryChipIcon}>{cat.icon_path}</Text>
                                <Text
                                  style={[
                                    styles.categoryChipText,
                                    { color: isSelected ? '#FFFFFF' : color },
                                  ]}
                                >
                                  {cat.name}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </ScrollView>
                    </Field>

                    {/* ── Reminder toggle ───────────────────────────────── */}
                    <View style={[styles.toggleRow, { borderColor: theme.border }]}>
                      <View style={styles.toggleInfo}>
                        <Text style={styles.toggleIcon}>🔔</Text>
                        <View>
                          <Text style={[styles.toggleLabel, { color: theme.text }]}>Reminder</Text>
                          <Text style={[styles.toggleSub, { color: theme.textMuted }]}>
                            {settings?.default_reminder
                              ? `${settings.default_reminder} min before`
                              : 'Notify before task starts'}
                          </Text>
                        </View>
                      </View>
                      <Switch
                        value={form.reminderEnabled}
                        onValueChange={(v) => setForm((p) => ({ ...p, reminderEnabled: v }))}
                        trackColor={{ false: theme.border, true: COLORS.primary + '60' }}
                        thumbColor={form.reminderEnabled ? COLORS.primary : theme.textMuted}
                      />
                    </View>

                    {/* ── Recurrence ───────────────────────────────────── */}
                    <Field label="Repeat">
                      <View style={styles.recurrenceOptions}>
                        {RECURRENCE_OPTIONS.map((opt) => {
                          const isSelected = form.recurrenceType === opt.value;
                          return (
                            <TouchableOpacity
                              key={opt.value}
                              style={[
                                styles.recurrenceChip,
                                { borderColor: isSelected ? COLORS.primary : theme.border },
                                isSelected && { backgroundColor: COLORS.primaryLight },
                              ]}
                              onPress={() => setForm((p) => ({ ...p, recurrenceType: opt.value }))}
                              activeOpacity={0.8}
                            >
                              <Text style={styles.recurrenceChipIcon}>{opt.icon}</Text>
                              <Text
                                style={[
                                  styles.recurrenceChipText,
                                  { color: isSelected ? COLORS.primary : theme.textSecondary },
                                ]}
                              >
                                {opt.label}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>

                      {/* Recurring: interval picker */}
                      {form.recurrenceType === 'RECURRING' && (
                        <View style={styles.intervalPicker}>
                          <Text style={[styles.intervalLabel, { color: theme.textSecondary }]}>
                            Every
                          </Text>
                          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            <View style={{ flexDirection: 'row', gap: 8 }}>
                              {INTERVAL_OPTIONS.map((opt) => {
                                const isSelected = form.recurrenceInterval === opt.value;
                                return (
                                  <TouchableOpacity
                                    key={opt.value}
                                    style={[
                                      styles.intervalChip,
                                      { borderColor: isSelected ? COLORS.primary : theme.border },
                                      isSelected && { backgroundColor: COLORS.primary },
                                    ]}
                                    onPress={() =>
                                      setForm((p) => ({ ...p, recurrenceInterval: opt.value }))
                                    }
                                    activeOpacity={0.8}
                                  >
                                    <Text
                                      style={[
                                        styles.intervalChipText,
                                        { color: isSelected ? '#FFF' : theme.text },
                                      ]}
                                    >
                                      {opt.label}
                                    </Text>
                                  </TouchableOpacity>
                                );
                              })}
                            </View>
                          </ScrollView>
                        </View>
                      )}

                      {/* Custom: weekday checkboxes + due date */}
                      {form.recurrenceType === 'CUSTOM' && (
                        <View style={styles.customSection}>
                          <Text style={[styles.intervalLabel, { color: theme.textSecondary }]}>
                            Repeat on
                          </Text>
                          <View style={styles.weekdayRow}>
                            {WEEKDAYS.map((day, i) => {
                              const val = WEEKDAY_VALUES[i]!;
                              const isSelected = form.customDays.includes(val);
                              return (
                                <TouchableOpacity
                                  key={day}
                                  style={[
                                    styles.weekdayChip,
                                    { borderColor: isSelected ? COLORS.primary : theme.border },
                                    isSelected && { backgroundColor: COLORS.primary },
                                  ]}
                                  onPress={() => toggleCustomDay(val)}
                                  activeOpacity={0.8}
                                >
                                  <Text
                                    style={[
                                      styles.weekdayText,
                                      { color: isSelected ? '#FFF' : theme.text },
                                    ]}
                                  >
                                    {day}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>

                          <TouchableOpacity
                            style={[
                              styles.pickerBtn,
                              { backgroundColor: theme.background, borderColor: theme.border },
                            ]}
                            onPress={() => setShowDueDatePicker(true)}
                            activeOpacity={0.8}
                          >
                            <Text style={styles.pickerBtnIcon}>📆</Text>
                            <Text style={[styles.pickerBtnText, { color: theme.text }]}>
                              {form.dueDate
                                ? `Until ${formatDate(toDateString(form.dueDate))}`
                                : 'Due date (optional)'}
                            </Text>
                          </TouchableOpacity>
                          {showDueDatePicker && (
                            <DateTimePicker
                              value={form.dueDate ?? new Date()}
                              mode="date"
                              minimumDate={form.date}
                              onChange={(_, date) => {
                                setShowDueDatePicker(false);
                                if (date) setForm((p) => ({ ...p, dueDate: date }));
                              }}
                            />
                          )}
                        </View>
                      )}
                    </Field>

                    {/* Save button */}
                    <TouchableOpacity
                      style={[
                        styles.saveBtn,
                        { backgroundColor: COLORS.primary, opacity: isSaving ? 0.7 : 1 },
                      ]}
                      onPress={handleSave}
                      disabled={isSaving}
                      activeOpacity={0.8}
                    >
                      {isSaving ? (
                        <ActivityIndicator color="#FFF" />
                      ) : (
                        <Text style={styles.saveBtnText}>
                          {task ? 'Save Changes' : 'Create Task'}
                        </Text>
                      )}
                    </TouchableOpacity>
                  </ScrollView>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

      {/* Conflict dialog */}
      <ConflictDialog
        visible={showConflict}
        conflict={conflict}
        onReschedule={() => setShowConflict(false)}
        onOverride={async () => {
          setShowConflict(false);
          await doSave(true);
        }}
      />

      {/* Recurrence scope prompt (for recurring task edits) */}
      <RecurrencePrompt
        visible={showRecurrencePrompt}
        mode="edit"
        onSelect={handleRecurrenceScope}
        onCancel={() => setShowRecurrencePrompt(false)}
      />
    </>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Field({
  label,
  children,
  style,
}: {
  label: string;
  children: React.ReactNode;
  style?: object;
}) {
  const theme = useAppTheme();
  return (
    <View style={[styles.field, style]}>
      <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>{label}</Text>
      {children}
    </View>
  );
}

function DurationInput({
  value,
  onChange,
  max,
  label,
  theme,
  step = 1,
}: {
  value: number;
  onChange: (v: number) => void;
  max: number;
  label: string;
  theme: ReturnType<typeof useAppTheme>;
  step?: number;
}) {
  return (
    <View style={styles.durationInput}>
      <TouchableOpacity
        style={[styles.durationBtn, { borderColor: theme.border }]}
        onPress={() => onChange(Math.max(0, value - step))}
        activeOpacity={0.8}
      >
        <Text style={[styles.durationBtnText, { color: theme.text }]}>−</Text>
      </TouchableOpacity>
      <View style={[styles.durationValue, { backgroundColor: theme.background, borderColor: theme.border }]}>
        <Text style={[styles.durationValueText, { color: theme.text }]}>
          {String(value).padStart(2, '0')}
        </Text>
        <Text style={[styles.durationUnit, { color: theme.textMuted }]}>{label}</Text>
      </View>
      <TouchableOpacity
        style={[styles.durationBtn, { borderColor: theme.border }]}
        onPress={() => onChange(Math.min(max, value + step))}
        activeOpacity={0.8}
      >
        <Text style={[styles.durationBtnText, { color: theme.text }]}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: 18,
    fontWeight: '400',
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 48,
    gap: 16,
  },
  field: { gap: 8 },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  multiline: {
    height: 80,
    paddingTop: 12,
  },
  row2: {
    flexDirection: 'row',
    gap: 12,
  },
  pickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  pickerBtnIcon: { fontSize: 16 },
  pickerBtnText: { fontSize: 14, fontWeight: '500', flex: 1 },
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  durationInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  durationSep: {
    fontSize: 20,
    fontWeight: '700',
  },
  durationBtn: {
    width: 36,
    height: 36,
    borderWidth: 1.5,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationBtnText: {
    fontSize: 18,
    fontWeight: '500',
    lineHeight: 22,
  },
  durationValue: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1.5,
    borderRadius: 10,
    minWidth: 60,
    justifyContent: 'center',
  },
  durationValueText: {
    fontSize: 18,
    fontWeight: '700',
  },
  durationUnit: {
    fontSize: 12,
    fontWeight: '600',
  },
  categoryRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  categoryChipIcon: { fontSize: 14 },
  categoryChipText: { fontSize: 13, fontWeight: '600' },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  toggleInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  toggleIcon: { fontSize: 20 },
  toggleLabel: { fontSize: 15, fontWeight: '600', marginBottom: 1 },
  toggleSub: { fontSize: 12 },
  recurrenceOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  recurrenceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  recurrenceChipIcon: { fontSize: 14 },
  recurrenceChipText: { fontSize: 13, fontWeight: '600' },
  intervalPicker: {
    marginTop: 12,
    gap: 8,
  },
  intervalLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  intervalChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  intervalChipText: { fontSize: 13, fontWeight: '600' },
  customSection: {
    marginTop: 12,
    gap: 12,
  },
  weekdayRow: {
    flexDirection: 'row',
    gap: 6,
  },
  weekdayChip: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1.5,
  },
  weekdayText: { fontSize: 11, fontWeight: '700' },
  saveBtn: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
