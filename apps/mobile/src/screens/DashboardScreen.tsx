import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { format, subDays } from 'date-fns';

import {
  getTaskOccurrences,
  getDashboardStreaks,
  getTimeSpent,
  getCompletionRate,
  generateToday,
  getCategories,
} from '../api/client';
import { TaskOccurrence } from '../types';
import { COLORS } from '../constants/colors';
import { useAppTheme } from '../hooks/useAppTheme';
import { today, getGreeting, formatDate } from '../lib/utils';

import StreakCard from '../components/StreakCard';
import Charts from '../components/Charts';
import TaskCard from '../components/TaskCard';
import TaskModal from '../components/TaskModal';

const TODAY = today();
const QUERY_KEY = ['task-occurrences', 'today'];

export default function DashboardScreen() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();

  const [showTaskModal, setShowTaskModal] = React.useState(false);
  const [editingTask, setEditingTask] = React.useState<TaskOccurrence | null>(null);
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  // Date range for charts (last 7 days)
  const chartEnd = TODAY;
  const chartStart = format(subDays(new Date(), 6), 'yyyy-MM-dd');

  // ── Queries ─────────────────────────────────────────────────────────────────

  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => getTaskOccurrences({ date: TODAY }),
  });

  const { data: streaks, isLoading: streaksLoading } = useQuery({
    queryKey: ['streaks'],
    queryFn: getDashboardStreaks,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
  });

  const { data: timeSpent = [] } = useQuery({
    queryKey: ['time-spent', chartStart, chartEnd],
    queryFn: () => getTimeSpent(chartStart, chartEnd),
  });

  const { data: completionRate = [] } = useQuery({
    queryKey: ['completion-rate', chartStart, chartEnd],
    queryFn: () => getCompletionRate(chartStart, chartEnd),
  });

  // Generate today's tasks from templates on mount
  const generateMutation = useMutation({
    mutationFn: generateToday,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  React.useEffect(() => {
    generateMutation.mutate();
  }, []);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: ['streaks'] }),
      queryClient.invalidateQueries({ queryKey: ['time-spent'] }),
      queryClient.invalidateQueries({ queryKey: ['completion-rate'] }),
    ]);
    setIsRefreshing(false);
  }, [queryClient]);

  const handleEdit = useCallback((task: TaskOccurrence) => {
    setEditingTask(task);
    setShowTaskModal(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setShowTaskModal(false);
    setEditingTask(null);
  }, []);

  // ── Task groups ─────────────────────────────────────────────────────────────

  const todayTasks = useMemo(
    () =>
      [...tasks].sort((a, b) => a.start_time.localeCompare(b.start_time)).slice(0, 5),
    [tasks]
  );

  const completedCount = tasks.filter((t) => t.status === 'COMPLETED').length;
  const totalCount = tasks.length;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 80 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
          />
        }
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.greeting, { color: theme.textSecondary }]}>
              {getGreeting()} 👋
            </Text>
            <Text style={[styles.dateText, { color: theme.text }]}>
              {format(new Date(), 'EEEE, MMMM d')}
            </Text>
          </View>

          {/* Progress pill */}
          <View style={[styles.progressPill, { backgroundColor: COLORS.primaryLight }]}>
            <Text style={[styles.progressText, { color: COLORS.primary }]}>
              {completedCount}/{totalCount} done
            </Text>
          </View>
        </View>

        {/* ── Progress bar ──────────────────────────────────────────────── */}
        {totalCount > 0 && (
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.progressBarHeader}>
              <Text style={[styles.progressBarLabel, { color: theme.text }]}>Today's Progress</Text>
              <Text style={[styles.progressBarPct, { color: COLORS.primary }]}>
                {Math.round((completedCount / totalCount) * 100)}%
              </Text>
            </View>
            <View style={[styles.progressTrack, { backgroundColor: theme.border }]}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${(completedCount / totalCount) * 100}%`,
                    backgroundColor: COLORS.primary,
                  },
                ]}
              />
            </View>
            <Text style={[styles.progressSub, { color: theme.textSecondary }]}>
              {totalCount - completedCount} tasks remaining
            </Text>
          </View>
        )}

        {/* ── Streak Card ───────────────────────────────────────────────── */}
        {streaksLoading ? (
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border, alignItems: 'center', paddingVertical: 32 }]}>
            <ActivityIndicator color={COLORS.primary} />
          </View>
        ) : streaks ? (
          <StreakCard streaks={streaks} />
        ) : null}

        {/* ── Today's Tasks ─────────────────────────────────────────────── */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Today's Tasks</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('Tasks')}
            activeOpacity={0.8}
          >
            <Text style={[styles.viewAll, { color: COLORS.primary }]}>View all →</Text>
          </TouchableOpacity>
        </View>

        {tasksLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color={COLORS.primary} />
          </View>
        ) : todayTasks.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={styles.emptyIcon}>🎯</Text>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No tasks for today</Text>
            <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
              Tap the + button to add your first task
            </Text>
            <TouchableOpacity
              style={[styles.addFirstBtn, { backgroundColor: COLORS.primary }]}
              onPress={() => {
                setEditingTask(null);
                setShowTaskModal(true);
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.addFirstBtnText}>+ Add Task</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View>
            {todayTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                categories={categories}
                onEdit={handleEdit}
                queryKey={QUERY_KEY}
              />
            ))}
            {tasks.length > 5 && (
              <TouchableOpacity
                style={[styles.viewMoreBtn, { borderColor: theme.border }]}
                onPress={() => navigation.navigate('Tasks')}
                activeOpacity={0.8}
              >
                <Text style={[styles.viewMoreText, { color: theme.textSecondary }]}>
                  View {tasks.length - 5} more tasks
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ── Charts ───────────────────────────────────────────────────── */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Analytics</Text>
        </View>
        <Charts timeSpent={timeSpent} completionRate={completionRate} />
      </ScrollView>

      {/* ── FAB ──────────────────────────────────────────────────────────── */}
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
        defaultDate={new Date()}
        queryKey={QUERY_KEY}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  greeting: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 2,
  },
  dateText: {
    fontSize: 22,
    fontWeight: '800',
  },
  progressPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  progressText: {
    fontSize: 13,
    fontWeight: '700',
  },
  card: {
    borderRadius: 16,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    gap: 10,
  },
  progressBarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressBarLabel: { fontSize: 14, fontWeight: '600' },
  progressBarPct: { fontSize: 16, fontWeight: '800' },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: 8,
    borderRadius: 4,
  },
  progressSub: { fontSize: 12, fontWeight: '500' },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: { fontSize: 17, fontWeight: '700' },
  viewAll: { fontSize: 14, fontWeight: '600' },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyCard: {
    borderRadius: 16,
    padding: 32,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    gap: 8,
  },
  emptyIcon: { fontSize: 40, marginBottom: 4 },
  emptyTitle: { fontSize: 16, fontWeight: '700' },
  emptySubtitle: { fontSize: 13, textAlign: 'center', lineHeight: 18 },
  addFirstBtn: {
    marginTop: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  addFirstBtnText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  viewMoreBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 12,
    borderStyle: 'dashed',
    marginTop: 4,
  },
  viewMoreText: { fontSize: 13, fontWeight: '500' },
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
