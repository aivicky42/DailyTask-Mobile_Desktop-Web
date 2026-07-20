import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { addDays, subDays, format } from 'date-fns';

import { getTaskOccurrences, getCategories } from '../api/client';
import { TaskOccurrence, TaskStatus } from '../types';
import { COLORS } from '../constants/colors';
import { useAppTheme } from '../hooks/useAppTheme';
import { toDateString, formatDateLong } from '../lib/utils';

import TaskCard from '../components/TaskCard';
import TaskModal from '../components/TaskModal';
import CategoryBadge from '../components/CategoryBadge';

type StatusTab = TaskStatus | 'ALL';

const STATUS_TABS: { key: StatusTab; label: string }[] = [
  { key: 'TODO', label: 'To Do' },
  { key: 'IN_PROGRESS', label: 'In Progress' },
  { key: 'COMPLETED', label: 'Completed' },
];

export default function TasksScreen() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [activeTab, setActiveTab] = useState<StatusTab>('TODO');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskOccurrence | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const dateStr = toDateString(currentDate);
  const QUERY_KEY = ['task-occurrences', 'tasks-screen', dateStr];

  // ── Queries ─────────────────────────────────────────────────────────────────

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => getTaskOccurrences({ date: dateStr }),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
  });

  // ── Filtered Tasks ────────────────────────────────────────────────────────

  const filteredTasks = useMemo(() => {
    let filtered = tasks;

    if (selectedCategoryId) {
      filtered = filtered.filter((t) => t.category_id === selectedCategoryId);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.description?.toLowerCase().includes(q) ?? false)
      );
    }

    return filtered.sort((a, b) => a.start_time.localeCompare(b.start_time));
  }, [tasks, selectedCategoryId, searchQuery]);

  const tasksByStatus = useMemo(() => {
    const grouped: Record<TaskStatus, TaskOccurrence[]> = {
      TODO: [],
      IN_PROGRESS: [],
      COMPLETED: [],
    };
    filteredTasks.forEach((t) => grouped[t.status].push(t));
    return grouped;
  }, [filteredTasks]);

  const displayedTasks =
    activeTab === 'ALL' ? filteredTasks : tasksByStatus[activeTab as TaskStatus] ?? [];

  // ── Handlers ─────────────────────────────────────────────────────────────

  const goToPrevDay = useCallback(() => setCurrentDate((d) => subDays(d, 1)), []);
  const goToNextDay = useCallback(() => setCurrentDate((d) => addDays(d, 1)), []);
  const goToToday = useCallback(() => setCurrentDate(new Date()), []);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    setIsRefreshing(false);
  }, [queryClient, QUERY_KEY]);

  const handleEdit = useCallback((task: TaskOccurrence) => {
    setEditingTask(task);
    setShowTaskModal(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setShowTaskModal(false);
    setEditingTask(null);
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────

  const isToday = dateStr === toDateString(new Date());

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      {/* ── Sticky Header ──────────────────────────────────────────────── */}
      <View
        style={[
          styles.stickyHeader,
          {
            backgroundColor: theme.background,
            paddingTop: insets.top + 12,
            borderBottomColor: theme.border,
          },
        ]}
      >
        {/* Date navigation */}
        <View style={styles.dateNav}>
          <TouchableOpacity
            style={[styles.dateNavBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={goToPrevDay}
            activeOpacity={0.8}
          >
            <Text style={[styles.dateNavIcon, { color: theme.text }]}>‹</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={goToToday} activeOpacity={0.8} style={styles.dateTitleBtn}>
            <Text style={[styles.dateTitle, { color: theme.text }]}>
              {formatDateLong(dateStr)}
            </Text>
            {!isToday && (
              <Text style={[styles.todayHint, { color: COLORS.primary }]}>Back to today</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.dateNavBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={goToNextDay}
            activeOpacity={0.8}
          >
            <Text style={[styles.dateNavIcon, { color: theme.text }]}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={[styles.searchBar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search tasks..."
            placeholderTextColor={theme.textMuted}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} activeOpacity={0.8}>
              <Text style={[styles.clearBtn, { color: theme.textMuted }]}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Category filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryFilter}>
          <TouchableOpacity
            style={[
              styles.categoryFilterChip,
              {
                backgroundColor: !selectedCategoryId ? COLORS.primary : theme.surface,
                borderColor: !selectedCategoryId ? COLORS.primary : theme.border,
              },
            ]}
            onPress={() => setSelectedCategoryId(null)}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.categoryFilterText,
                { color: !selectedCategoryId ? '#FFF' : theme.textSecondary },
              ]}
            >
              All
            </Text>
          </TouchableOpacity>

          {categories.map((cat) => {
            const isSelected = selectedCategoryId === cat.id;
            const color = cat.color_hex || COLORS.primary;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.categoryFilterChip,
                  {
                    backgroundColor: isSelected ? color : `${color}15`,
                    borderColor: isSelected ? color : 'transparent',
                  },
                ]}
                onPress={() =>
                  setSelectedCategoryId((prev) => (prev === cat.id ? null : cat.id))
                }
                activeOpacity={0.8}
              >
                <Text style={styles.categoryFilterIcon}>{cat.icon_path}</Text>
                <Text
                  style={[
                    styles.categoryFilterText,
                    { color: isSelected ? '#FFF' : color },
                  ]}
                >
                  {cat.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Status tabs */}
        <View style={styles.tabsRow}>
          {STATUS_TABS.map((tab) => {
            const count = tasksByStatus[tab.key as TaskStatus]?.length ?? 0;
            const isActive = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[
                  styles.tab,
                  isActive && { borderBottomColor: COLORS.primary, borderBottomWidth: 2.5 },
                ]}
                onPress={() => setActiveTab(tab.key)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.tabLabel,
                    { color: isActive ? COLORS.primary : theme.textSecondary },
                    isActive && { fontWeight: '700' },
                  ]}
                >
                  {tab.label}
                </Text>
                {count > 0 && (
                  <View
                    style={[
                      styles.tabBadge,
                      {
                        backgroundColor: isActive ? COLORS.primary : theme.border,
                      },
                    ]}
                  >
                    <Text style={[styles.tabBadgeText, { color: isActive ? '#FFF' : theme.textSecondary }]}>
                      {count}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* ── Task List ─────────────────────────────────────────────────────── */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={displayedTasks}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 80 },
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
          renderItem={({ item }) => (
            <TaskCard
              task={item}
              categories={categories}
              onEdit={handleEdit}
              queryKey={QUERY_KEY}
            />
          )}
          ListEmptyComponent={
            <View style={[styles.emptyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={styles.emptyIcon}>
                {activeTab === 'COMPLETED' ? '🏆' : activeTab === 'IN_PROGRESS' ? '⏱️' : '✅'}
              </Text>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>
                {searchQuery
                  ? 'No results found'
                  : activeTab === 'COMPLETED'
                  ? 'Nothing completed yet'
                  : activeTab === 'IN_PROGRESS'
                  ? 'Nothing in progress'
                  : 'All done! 🎉'}
              </Text>
              <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
                {searchQuery
                  ? `No tasks match "${searchQuery}"`
                  : activeTab === 'TODO'
                  ? 'No pending tasks for today'
                  : ''}
              </Text>
            </View>
          }
        />
      )}

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
        defaultDate={currentDate}
        queryKey={QUERY_KEY}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  stickyHeader: {
    paddingHorizontal: 16,
    paddingBottom: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  dateNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateNavBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  dateNavIcon: { fontSize: 22, fontWeight: '400', lineHeight: 26 },
  dateTitleBtn: { alignItems: 'center' },
  dateTitle: { fontSize: 18, fontWeight: '700' },
  todayHint: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchIcon: { fontSize: 16 },
  searchInput: { flex: 1, fontSize: 15, padding: 0 },
  clearBtn: { fontSize: 14, padding: 4 },
  categoryFilter: { marginHorizontal: -4 },
  categoryFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    marginHorizontal: 4,
  },
  categoryFilterIcon: { fontSize: 13 },
  categoryFilterText: { fontSize: 13, fontWeight: '600' },
  tabsRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'transparent',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 5,
    borderBottomWidth: 2.5,
    borderBottomColor: 'transparent',
  },
  tabLabel: { fontSize: 13, fontWeight: '500' },
  tabBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 20,
    minWidth: 20,
    alignItems: 'center',
  },
  tabBadgeText: { fontSize: 11, fontWeight: '700' },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 0,
  },
  emptyCard: {
    borderRadius: 16,
    padding: 40,
    marginTop: 16,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    gap: 8,
  },
  emptyIcon: { fontSize: 40, marginBottom: 4 },
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
