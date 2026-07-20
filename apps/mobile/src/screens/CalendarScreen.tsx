import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format, addMonths, subMonths, startOfMonth, endOfMonth } from 'date-fns';

import { getTaskOccurrences, getCategories } from '../api/client';
import { TaskOccurrence } from '../types';
import { COLORS } from '../constants/colors';
import { useAppTheme } from '../hooks/useAppTheme';
import { toDateString } from '../lib/utils';

import CalendarGrid from '../components/CalendarGrid';
import TaskCard from '../components/TaskCard';
import TaskModal from '../components/TaskModal';

export default function CalendarScreen() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [displayMonth, setDisplayMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskOccurrence | null>(null);

  const monthStart = toDateString(startOfMonth(displayMonth));
  const monthEnd = toDateString(endOfMonth(displayMonth));
  const selectedDateStr = toDateString(selectedDate);

  const QUERY_KEY = ['task-occurrences', 'calendar', monthStart, monthEnd];

  // ── Queries ─────────────────────────────────────────────────────────────────

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () =>
      getTaskOccurrences({ start_date: monthStart, end_date: monthEnd }),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
  });

  // ── Selected day tasks ───────────────────────────────────────────────────────

  const selectedTasks = useMemo(
    () =>
      tasks
        .filter((t) => t.date.split('T')[0] === selectedDateStr)
        .sort((a, b) => a.start_time.localeCompare(b.start_time)),
    [tasks, selectedDateStr]
  );

  // ── Stats for selected day ───────────────────────────────────────────────────

  const dayStats = useMemo(() => {
    const done = selectedTasks.filter((t) => t.status === 'COMPLETED').length;
    const total = selectedTasks.length;
    return { done, total };
  }, [selectedTasks]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handlePrevMonth = useCallback(() => {
    setDisplayMonth((prev) => subMonths(prev, 1));
  }, []);

  const handleNextMonth = useCallback(() => {
    setDisplayMonth((prev) => addMonths(prev, 1));
  }, []);

  const handleSelectDate = useCallback((date: Date) => {
    setSelectedDate(date);
  }, []);

  const handleEdit = useCallback((task: TaskOccurrence) => {
    setEditingTask(task);
    setShowTaskModal(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setShowTaskModal(false);
    setEditingTask(null);
  }, []);

  const handleGoToday = useCallback(() => {
    const now = new Date();
    setDisplayMonth(now);
    setSelectedDate(now);
  }, []);

  // ── Render ──────────────────────────────────────────────────────────────────

  const isCurrentMonth =
    format(displayMonth, 'yyyy-MM') === format(new Date(), 'yyyy-MM');

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <FlatList
        data={selectedTasks}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 80 },
        ]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.topSection}>
            {/* ── Month Header ──────────────────────────────────────── */}
            <View style={styles.monthHeader}>
              <TouchableOpacity
                style={[styles.navBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
                onPress={handlePrevMonth}
                activeOpacity={0.8}
              >
                <Text style={[styles.navBtnText, { color: theme.text }]}>‹</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={handleGoToday} activeOpacity={0.8}>
                <Text style={[styles.monthTitle, { color: theme.text }]}>
                  {format(displayMonth, 'MMMM yyyy')}
                </Text>
                {!isCurrentMonth && (
                  <Text style={[styles.goToday, { color: COLORS.primary }]}>
                    Tap to go to today
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.navBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
                onPress={handleNextMonth}
                activeOpacity={0.8}
              >
                <Text style={[styles.navBtnText, { color: theme.text }]}>›</Text>
              </TouchableOpacity>
            </View>

            {/* ── Calendar Grid ─────────────────────────────────────── */}
            <View style={[styles.calendarCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              {isLoading ? (
                <View style={styles.calendarLoading}>
                  <ActivityIndicator color={COLORS.primary} />
                </View>
              ) : (
                <CalendarGrid
                  displayMonth={displayMonth}
                  selectedDate={selectedDate}
                  tasks={tasks}
                  categories={categories}
                  onSelectDate={handleSelectDate}
                />
              )}
            </View>

            {/* ── Selected Day Header ───────────────────────────────── */}
            <View style={styles.dayHeader}>
              <View>
                <Text style={[styles.dayTitle, { color: theme.text }]}>
                  {format(selectedDate, 'EEEE, MMMM d')}
                </Text>
                {dayStats.total > 0 && (
                  <Text style={[styles.dayStats, { color: theme.textSecondary }]}>
                    {dayStats.done}/{dayStats.total} completed
                  </Text>
                )}
              </View>
              <TouchableOpacity
                style={[styles.addDayBtn, { backgroundColor: COLORS.primary }]}
                onPress={() => {
                  setEditingTask(null);
                  setShowTaskModal(true);
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.addDayBtnText}>+ Task</Text>
              </TouchableOpacity>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.taskWrapper}>
            <TaskCard
              task={item}
              categories={categories}
              onEdit={handleEdit}
              queryKey={QUERY_KEY}
            />
          </View>
        )}
        ListEmptyComponent={
          !isLoading ? (
            <View style={[styles.emptyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={styles.emptyIcon}>📭</Text>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No tasks</Text>
              <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
                No tasks scheduled for this day
              </Text>
            </View>
          ) : null
        }
      />

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, { bottom: insets.bottom + 72 }]}
        onPress={() => {
          setEditingTask(null);
          setShowTaskModal(true);
        }}
        activeOpacity={0.85}
      >
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>

      {/* Task Modal */}
      <TaskModal
        visible={showTaskModal}
        onClose={handleCloseModal}
        task={editingTask}
        defaultDate={selectedDate}
        queryKey={QUERY_KEY}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  listContent: {
    paddingHorizontal: 16,
    gap: 0,
  },
  topSection: {
    gap: 16,
    marginBottom: 16,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  navBtnText: {
    fontSize: 22,
    fontWeight: '400',
    lineHeight: 26,
  },
  monthTitle: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  goToday: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 2,
  },
  calendarCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  calendarLoading: {
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dayTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  dayStats: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  addDayBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  addDayBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  taskWrapper: {
    marginBottom: 0,
  },
  emptyCard: {
    borderRadius: 16,
    padding: 32,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    gap: 8,
  },
  emptyIcon: { fontSize: 36, marginBottom: 4 },
  emptyTitle: { fontSize: 16, fontWeight: '700' },
  emptySubtitle: { fontSize: 13, textAlign: 'center' },
  fab: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  fabIcon: { color: '#FFF', fontSize: 28, fontWeight: '300', lineHeight: 32 },
});
