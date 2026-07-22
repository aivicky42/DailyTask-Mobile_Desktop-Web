import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Play, Pause, CheckCircle2, Circle, Pencil, Trash2,
  Clock, RefreshCw, ChevronRight,
} from 'lucide-react';
import { cn, formatTime12, minutesToHM, formatElapsed } from '../lib/utils';
import { updateTaskOccurrence, deleteTaskOccurrence } from '../api/client';
import { useTimerStore } from '../store/timerStore';
import { useTimer } from '../hooks/useTimer';
import CategoryBadge from './CategoryBadge';
import RecurrencePrompt from './RecurrencePrompt';
import type { TaskOccurrence, Category, TaskStatus, DeleteScope } from '../types';

interface TaskCardProps {
  task: TaskOccurrence;
  categories: Category[];
  onEdit: (task: TaskOccurrence) => void;
  compact?: boolean;
}

export default function TaskCard({ task, categories, onEdit, compact = false }: TaskCardProps) {
  const qc = useQueryClient();
  const [showRecurrencePrompt, setShowRecurrencePrompt] = useState(false);

  const { activeTaskId, isRunning, getCurrentElapsed } = useTimerStore();
  const { play, pause } = useTimer(task.time_to_complete);

  const isThisTask = activeTaskId === task.id;
  const isTimerRunning = isThisTask && isRunning;

  // Live elapsed for this task, or static from server data
  const elapsed = isThisTask ? getCurrentElapsed() : task.elapsed_time;
  const totalSeconds = task.time_to_complete * 60;
  const remaining = Math.max(0, totalSeconds - elapsed);

  const category = categories.find((c) => c.id === task.category_id);

  const statusMut = useMutation({
    mutationFn: ({ status }: { status: TaskStatus }) =>
      updateTaskOccurrence(task.id, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task-occurrences'] });
      qc.invalidateQueries({ queryKey: ['dashboard-streaks'] });
      qc.invalidateQueries({ queryKey: ['time-spent'] });
      qc.invalidateQueries({ queryKey: ['completion-rate'] });
    },
  });

  const deleteMut = useMutation({
    mutationFn: ({ scope, dateRange }: { scope?: DeleteScope; dateRange?: { start: string; end: string } }) =>
      deleteTaskOccurrence(task.id, scope, dateRange),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task-occurrences'] });
      qc.invalidateQueries({ queryKey: ['dashboard-streaks'] });
      qc.invalidateQueries({ queryKey: ['time-spent'] });
      qc.invalidateQueries({ queryKey: ['completion-rate'] });
    },
  });

  const handlePlay = useCallback(async () => {
    try {
      await play(task.id, task.elapsed_time);
    } catch (err) {
      console.error('Failed to start timer:', err);
    }
  }, [play, task.id, task.elapsed_time]);

  const handlePause = useCallback(async () => {
    try {
      await pause();
    } catch (err) {
      console.error('Failed to pause timer:', err);
    }
  }, [pause]);

  const handleToggleComplete = () => {
    const newStatus: TaskStatus =
      task.status === 'COMPLETED' ? 'TODO' : 'COMPLETED';
    statusMut.mutate({ status: newStatus });
  };

  const handleDelete = () => {
    if (task.task_template_id) {
      setShowRecurrencePrompt(true);
    } else {
      if (confirm(`Delete "${task.title}"?`)) {
        deleteMut.mutate({ scope: 'SINGLE' });
      }
    }
  };

  const handleRecurrenceDelete = (scope: DeleteScope, dateRange?: { start: string; end: string }) => {
    setShowRecurrencePrompt(false);
    deleteMut.mutate({ scope, dateRange });
  };

  // ── Status colours ─────────────────────────────────────────────────
  const statusColors: Record<TaskStatus, string> = {
    TODO: 'border-l-gray-300',
    IN_PROGRESS: 'border-l-blue-400',
    COMPLETED: 'border-l-green-400',
  };

  const progress = totalSeconds > 0 ? Math.min(1, elapsed / totalSeconds) : 0;

  if (compact) {
    // ── Compact variant (dashboard today list) ────────────────────────
    return (
      <div className={cn(
        'flex items-center gap-3 p-3 rounded-xl border-l-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 group transition-all hover:shadow-sm',
        statusColors[task.status],
      )}>
        {/* Checkbox */}
        <button
          onClick={handleToggleComplete}
          className={cn(
            'flex-shrink-0 transition-colors',
            task.status === 'COMPLETED'
              ? 'text-green-500'
              : 'text-gray-300 dark:text-gray-600 hover:text-primary',
          )}
          disabled={statusMut.isPending}
        >
          {task.status === 'COMPLETED' ? (
            <CheckCircle2 size={20} />
          ) : (
            <Circle size={20} />
          )}
        </button>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className={cn(
            'text-sm font-medium truncate',
            task.status === 'COMPLETED'
              ? 'line-through text-gray-400 dark:text-gray-500'
              : 'text-gray-900 dark:text-white',
          )}>
            {task.title}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {formatTime12(task.start_time)} · {minutesToHM(task.time_to_complete)}
          </p>
        </div>

        {/* Timer button */}
        {task.status !== 'COMPLETED' && (
          <button
            onClick={isTimerRunning ? handlePause : handlePlay}
            className={cn(
              'flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-colors',
              isTimerRunning
                ? 'bg-primary text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:text-primary',
            )}
          >
            {isTimerRunning ? <Pause size={12} /> : <Play size={12} />}
          </button>
        )}
      </div>
    );
  }

  // ── Full card variant ───────────────────────────────────────────────
  return (
    <>
      <div className={cn(
        'relative flex flex-col gap-3 p-4 rounded-xl border-l-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 group transition-all hover:shadow-md',
        statusColors[task.status],
        task.status === 'COMPLETED' && 'opacity-75',
      )}>
        {/* Progress bar */}
        {progress > 0 && (
          <div className="absolute top-0 left-4 right-4 h-0.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-1000"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
        )}

        {/* Row 1: Category + actions */}
        <div className="flex items-center justify-between gap-2 pt-1">
          <CategoryBadge category={category} />

          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {task.task_template_id && (
              <span title="Recurring task" className="text-gray-300 dark:text-gray-600">
                <RefreshCw size={12} />
              </span>
            )}
            <button
              onClick={() => onEdit(task)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-primary hover:bg-primary/10 transition-colors"
              title="Edit"
            >
              <Pencil size={14} />
            </button>
            <button
              onClick={handleDelete}
              disabled={deleteMut.isPending}
              className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              title="Delete"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        {/* Row 2: Title + checkbox */}
        <div className="flex items-start gap-3">
          <button
            onClick={handleToggleComplete}
            className={cn(
              'flex-shrink-0 mt-0.5 transition-colors',
              task.status === 'COMPLETED'
                ? 'text-green-500'
                : 'text-gray-300 dark:text-gray-600 hover:text-primary',
            )}
            disabled={statusMut.isPending}
          >
            {task.status === 'COMPLETED' ? (
              <CheckCircle2 size={20} />
            ) : (
              <Circle size={20} />
            )}
          </button>

          <div className="flex-1 min-w-0">
            <p className={cn(
              'font-medium text-gray-900 dark:text-white leading-snug',
              task.status === 'COMPLETED' && 'line-through text-gray-400 dark:text-gray-500',
            )}>
              {task.title}
            </p>
            {task.description && (
              <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                {task.description}
              </p>
            )}
          </div>
        </div>

        {/* Row 3: Time info + timer */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1">
              <Clock size={12} />
              {formatTime12(task.start_time)}
            </span>
            <span>·</span>
            <span>{minutesToHM(task.time_to_complete)}</span>
            {elapsed > 0 && (
              <>
                <span>·</span>
                <span className={cn(
                  'font-mono',
                  isTimerRunning && 'text-primary font-semibold',
                )}>
                  {formatElapsed(elapsed)}
                  {isTimerRunning && ' ▶'}
                </span>
              </>
            )}
          </div>

          {/* Timer control */}
          {task.status !== 'COMPLETED' && (
            <button
              onClick={isTimerRunning ? handlePause : handlePlay}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors',
                isTimerRunning
                  ? 'bg-primary text-white hover:bg-primary-600'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-primary/10 hover:text-primary',
              )}
            >
              {isTimerRunning ? (
                <>
                  <Pause size={12} />
                  Pause
                </>
              ) : (
                <>
                  <Play size={12} />
                  {elapsed > 0 ? 'Resume' : 'Start'}
                </>
              )}
            </button>
          )}
        </div>

        {/* Remaining time bar (only when running) */}
        {isTimerRunning && totalSeconds > 0 && (
          <div className="text-xs text-primary/70 font-mono">
            {formatElapsed(remaining)} remaining
          </div>
        )}
      </div>

      <RecurrencePrompt
        isOpen={showRecurrencePrompt}
        action="delete"
        taskTitle={task.title}
        onClose={() => setShowRecurrencePrompt(false)}
        onConfirm={handleRecurrenceDelete}
      />
    </>
  );
}
