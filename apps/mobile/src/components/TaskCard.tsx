import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { TaskOccurrence, Category, TaskStatus, DeleteScope } from '../types';
import { COLORS, getCategoryColor } from '../constants/colors';
import { useAppTheme } from '../hooks/useAppTheme';
import { useTimer } from '../hooks/useTimer';
import { useTimerStore } from '../store/timerStore';
import CategoryBadge from './CategoryBadge';
import RecurrencePrompt from './RecurrencePrompt';
import { updateTaskOccurrence, deleteTaskOccurrence } from '../api/client';
import {
  formatTimeDisplay,
  formatDuration,
  formatTimerCompact,
} from '../lib/utils';

interface Props {
  task: TaskOccurrence;
  categories: Category[];
  onEdit: (task: TaskOccurrence) => void;
  queryKey: unknown[];
}

const STATUS_CONFIG: Record<TaskStatus, { label: string; color: string; bg: string }> = {
  TODO: { label: 'To Do', color: COLORS.gray[400], bg: COLORS.gray[100] },
  IN_PROGRESS: { label: 'In Progress', color: COLORS.status.IN_PROGRESS, bg: '#EFF6FF' },
  COMPLETED: { label: 'Done', color: COLORS.success, bg: COLORS.successLight },
};

export default function TaskCard({ task, categories, onEdit, queryKey }: Props) {
  const theme = useAppTheme();
  const queryClient = useQueryClient();
  const { activeTaskId, isRunning } = useTimerStore();
  const { elapsed, compactElapsed, play, pause } = useTimer(task.time_to_complete);

  const isThisTaskActive = isRunning && activeTaskId === task.id;
  const category = categories.find((c) => c.id === task.category_id);
  const categoryColor = category?.color_hex || getCategoryColor(task.category_id);
  const statusCfg = STATUS_CONFIG[task.status];

  const [showRecurrencePrompt, setShowRecurrencePrompt] = useState(false);
  const [recurrenceMode, setRecurrenceMode] = useState<'edit' | 'delete'>('delete');
  const [isPlayLoading, setIsPlayLoading] = useState(false);

  // ── Mutations ───────────────────────────────────────────────────────────────

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const completeMutation = useMutation({
    mutationFn: (id: string) =>
      updateTaskOccurrence(id, {
        status: task.status === 'COMPLETED' ? 'TODO' : 'COMPLETED',
        elapsed_time: task.status === 'COMPLETED' ? task.elapsed_time : elapsed,
      }),
    onSuccess: invalidate,
    onError: () => Alert.alert('Error', 'Failed to update task status.'),
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id, scope, end_date }: { id: string; scope: DeleteScope; end_date?: string }) =>
      deleteTaskOccurrence(id, { scope, end_date }),
    onSuccess: invalidate,
    onError: () => Alert.alert('Error', 'Failed to delete task.'),
  });

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handlePlayPause = useCallback(async () => {
    if (isPlayLoading) return;
    setIsPlayLoading(true);
    try {
      if (isThisTaskActive) {
        await pause();
        // Update elapsed on backend
        await updateTaskOccurrence(task.id, { elapsed_time: elapsed });
        invalidate();
      } else {
        await play(task.id, task.elapsed_time);
        await updateTaskOccurrence(task.id, { status: 'IN_PROGRESS' });
        invalidate();
      }
    } catch {
      Alert.alert('Error', 'Failed to control timer.');
    } finally {
      setIsPlayLoading(false);
    }
  }, [isPlayLoading, isThisTaskActive, pause, play, elapsed, task, invalidate]);

  const handleDelete = useCallback(() => {
    if (task.task_template_id) {
      setRecurrenceMode('delete');
      setShowRecurrencePrompt(true);
    } else {
      Alert.alert('Delete Task', `Delete "${task.title}"?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteMutation.mutate({ id: task.id, scope: 'SINGLE' }),
        },
      ]);
    }
  }, [task, deleteMutation]);

  const handleRecurrenceSelect = useCallback(
    (scope: DeleteScope, end_date?: string) => {
      setShowRecurrencePrompt(false);
      deleteMutation.mutate({ id: task.id, scope, end_date });
    },
    [task.id, deleteMutation]
  );

  // ── Elapsed display ─────────────────────────────────────────────────────────

  const displayElapsed = isThisTaskActive ? elapsed : task.elapsed_time;
  const displayCompact = isThisTaskActive ? compactElapsed : formatTimerCompact(task.elapsed_time);
  const progress =
    task.time_to_complete > 0 ? Math.min(displayElapsed / task.time_to_complete, 1) : 0;

  return (
    <>
      <View
        style={[
          styles.card,
          { backgroundColor: theme.surface, borderColor: theme.border },
          { borderLeftColor: categoryColor },
        ]}
      >
        {/* Left accent border */}
        <View style={[styles.leftBorder, { backgroundColor: categoryColor }]} />

        <View style={styles.content}>
          {/* Header row */}
          <View style={styles.headerRow}>
            <CategoryBadge category={category} size="sm" />
            <View style={[styles.statusBadge, { backgroundColor: statusCfg.bg }]}>
              <Text style={[styles.statusText, { color: statusCfg.color }]}>
                {statusCfg.label}
              </Text>
            </View>
          </View>

          {/* Title */}
          <Text
            style={[
              styles.title,
              { color: theme.text },
              task.status === 'COMPLETED' && styles.completedTitle,
            ]}
            numberOfLines={2}
          >
            {task.title}
          </Text>

          {/* Description */}
          {task.description ? (
            <Text style={[styles.description, { color: theme.textSecondary }]} numberOfLines={2}>
              {task.description}
            </Text>
          ) : null}

          {/* Time info */}
          <View style={styles.timeRow}>
            <Text style={styles.clockIcon}>🕐</Text>
            <Text style={[styles.timeText, { color: theme.textMuted }]}>
              {formatTimeDisplay(task.start_time)} · {formatDuration(task.time_to_complete)}
            </Text>
            {displayElapsed > 0 && (
              <Text style={[styles.elapsedText, { color: COLORS.primary }]}>
                {' '}· {displayCompact} elapsed
              </Text>
            )}
          </View>

          {/* Progress bar (for IN_PROGRESS tasks) */}
          {(task.status === 'IN_PROGRESS' || isThisTaskActive) && task.time_to_complete > 0 && (
            <View style={[styles.progressTrack, { backgroundColor: theme.border }]}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${progress * 100}%`,
                    backgroundColor: isThisTaskActive ? COLORS.primary : COLORS.gray[400],
                  },
                ]}
              />
            </View>
          )}

          {/* Action row */}
          <View style={styles.actions}>
            {/* Play / Pause */}
            {task.status !== 'COMPLETED' && (
              <TouchableOpacity
                style={[
                  styles.actionBtn,
                  styles.playBtn,
                  {
                    backgroundColor: isThisTaskActive ? COLORS.primary : COLORS.primaryLight,
                  },
                ]}
                onPress={handlePlayPause}
                disabled={isPlayLoading}
                activeOpacity={0.8}
              >
                {isPlayLoading ? (
                  <ActivityIndicator size={14} color={isThisTaskActive ? '#FFF' : COLORS.primary} />
                ) : (
                  <Text
                    style={[
                      styles.playIcon,
                      { color: isThisTaskActive ? '#FFFFFF' : COLORS.primary },
                    ]}
                  >
                    {isThisTaskActive ? '⏸' : '▶'}
                  </Text>
                )}
                <Text
                  style={[
                    styles.playLabel,
                    { color: isThisTaskActive ? '#FFFFFF' : COLORS.primary },
                  ]}
                >
                  {isThisTaskActive ? 'Pause' : 'Play'}
                </Text>
              </TouchableOpacity>
            )}

            {/* Complete toggle */}
            <TouchableOpacity
              style={[
                styles.actionBtn,
                {
                  backgroundColor:
                    task.status === 'COMPLETED' ? COLORS.successLight : theme.background,
                  borderColor:
                    task.status === 'COMPLETED' ? COLORS.success : theme.border,
                },
              ]}
              onPress={() => completeMutation.mutate(task.id)}
              disabled={completeMutation.isPending}
              activeOpacity={0.8}
            >
              {completeMutation.isPending ? (
                <ActivityIndicator size={14} color={COLORS.success} />
              ) : (
                <Text
                  style={[
                    styles.playIcon,
                    { color: task.status === 'COMPLETED' ? COLORS.success : theme.textMuted },
                  ]}
                >
                  {task.status === 'COMPLETED' ? '✅' : '⬜'}
                </Text>
              )}
            </TouchableOpacity>

            <View style={styles.rightActions}>
              {/* Edit */}
              <TouchableOpacity
                style={[styles.iconBtn, { backgroundColor: theme.background, borderColor: theme.border }]}
                onPress={() => onEdit(task)}
                activeOpacity={0.8}
              >
                <Text style={styles.iconBtnText}>✏️</Text>
              </TouchableOpacity>

              {/* Delete */}
              <TouchableOpacity
                style={[styles.iconBtn, { backgroundColor: COLORS.dangerLight, borderColor: COLORS.danger + '40' }]}
                onPress={handleDelete}
                disabled={deleteMutation.isPending}
                activeOpacity={0.8}
              >
                {deleteMutation.isPending ? (
                  <ActivityIndicator size={14} color={COLORS.danger} />
                ) : (
                  <Text style={styles.iconBtnText}>🗑</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>

      {/* Recurrence prompt */}
      <RecurrencePrompt
        visible={showRecurrencePrompt}
        mode={recurrenceMode}
        onSelect={handleRecurrenceSelect}
        onCancel={() => setShowRecurrencePrompt(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    overflow: 'hidden',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  leftBorder: {
    width: 4,
  },
  content: {
    flex: 1,
    padding: 14,
    gap: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
  },
  completedTitle: {
    textDecorationLine: 'line-through',
    opacity: 0.5,
  },
  description: {
    fontSize: 13,
    lineHeight: 18,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  clockIcon: {
    fontSize: 12,
  },
  timeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  elapsedText: {
    fontSize: 12,
    fontWeight: '600',
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: 4,
    borderRadius: 2,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    gap: 5,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  playBtn: {
    borderWidth: 0,
  },
  playIcon: {
    fontSize: 13,
  },
  playLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  rightActions: {
    flexDirection: 'row',
    gap: 6,
    marginLeft: 'auto',
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  iconBtnText: {
    fontSize: 15,
  },
});
