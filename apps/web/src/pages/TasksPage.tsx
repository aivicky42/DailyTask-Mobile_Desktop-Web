import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ChevronLeft, ChevronRight, Search, SlidersHorizontal,
  CheckCircle2, Clock, ListTodo, X, CalendarCheck,
} from 'lucide-react';
import {
  formatDate, formatDateISO, addDays, subDays, parseISO, isToday,
} from '../lib/utils';
import { cn } from '../lib/utils';
import { getTaskOccurrences, getCategories } from '../api/client';
import TaskCard from '../components/TaskCard';
import TaskModal from '../components/TaskModal';
import type { TaskOccurrence, TaskStatus } from '../types';

type Tab = 'TODO' | 'IN_PROGRESS' | 'COMPLETED';

const TABS: { value: Tab; label: string; icon: React.ReactNode }[] = [
  { value: 'TODO',        label: 'To Do',      icon: <ListTodo size={14} />      },
  { value: 'IN_PROGRESS', label: 'In Progress', icon: <Clock size={14} />         },
  { value: 'COMPLETED',   label: 'Completed',   icon: <CheckCircle2 size={14} /> },
];

export default function TasksPage() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [activeTab, setActiveTab] = useState<Tab>('TODO');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [editingTask, setEditingTask] = useState<TaskOccurrence | null>(null);
  const [showAddTask, setShowAddTask] = useState(false);

  const dateStr = formatDateISO(selectedDate);

  const { data: tasks = [], isLoading, error } = useQuery({
    queryKey: ['task-occurrences', { date: dateStr }],
    queryFn: () => getTaskOccurrences({ date: dateStr }),
    staleTime: 15_000,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
    staleTime: 300_000,
  });

  // ── Filter pipeline ────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let result = tasks;

    if (categoryFilter) {
      result = result.filter((t) => t.category_id === categoryFilter);
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.description ?? '').toLowerCase().includes(q),
      );
    }

    return result;
  }, [tasks, categoryFilter, search]);

  const byStatus = useMemo(() => {
    const map: Record<Tab, TaskOccurrence[]> = {
      TODO: [], IN_PROGRESS: [], COMPLETED: [],
    };
    for (const t of filtered) {
      map[t.status as Tab]?.push(t);
    }
    return map;
  }, [filtered]);

  const displayedTasks = byStatus[activeTab];

  // ── Helpers ────────────────────────────────────────────────────────
  const goToday = () => setSelectedDate(new Date());
  const prevDay  = () => setSelectedDate((d) => subDays(d, 1));
  const nextDay  = () => setSelectedDate((d) => addDays(d, 1));

  return (
    <div className="space-y-5">
      {/* Page title */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Tasks</h1>
        <button
          onClick={() => setShowAddTask(true)}
          className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary-600 transition-colors"
        >
          + Add Task
        </button>
      </div>

      {/* Date navigation */}
      <div className="flex items-center gap-3 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-2 pr-4">
        <button
          onClick={prevDay}
          className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
          aria-label="Previous day"
        >
          <ChevronLeft size={18} />
        </button>

        <div className="flex-1 text-center">
          <p className="font-semibold text-gray-900 dark:text-white text-sm">
            {isToday(selectedDate) ? 'Today' : formatDate(selectedDate)}
          </p>
          {!isToday(selectedDate) && (
            <p className="text-xs text-gray-400 dark:text-gray-500">
              {formatDate(selectedDate)}
            </p>
          )}
        </div>

        <button
          onClick={nextDay}
          className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
          aria-label="Next day"
        >
          <ChevronRight size={18} />
        </button>

        {!isToday(selectedDate) && (
          <button
            onClick={goToday}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
          >
            <CalendarCheck size={13} />
            Today
          </button>
        )}
      </div>

      {/* Search + Category filter */}
      <div className="flex gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search
            size={15}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks..."
            className="w-full pl-9 pr-8 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 dark:hover:text-gray-300"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Category filter */}
        <div className="relative">
          <SlidersHorizontal
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="pl-8 pr-3 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors appearance-none cursor-pointer"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon_path} {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl">
        {TABS.map(({ value, label, icon }) => {
          const count = byStatus[value].length;
          return (
            <button
              key={value}
              onClick={() => setActiveTab(value)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all',
                activeTab === value
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200',
              )}
            >
              {icon}
              {label}
              {count > 0 && (
                <span
                  className={cn(
                    'ml-0.5 text-xs px-1.5 py-0.5 rounded-full font-semibold min-w-[20px] text-center',
                    activeTab === value
                      ? 'bg-primary/15 text-primary'
                      : 'bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400',
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Task list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-12 text-center bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
          <p className="text-sm text-red-500">Failed to load tasks. Please try again.</p>
        </div>
      ) : displayedTasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
          {activeTab === 'TODO' && (
            <>
              <ListTodo size={40} className="text-gray-200 dark:text-gray-600 mb-3" />
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No pending tasks</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">All clear! Add a task or pick another day.</p>
            </>
          )}
          {activeTab === 'IN_PROGRESS' && (
            <>
              <Clock size={40} className="text-gray-200 dark:text-gray-600 mb-3" />
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Nothing in progress</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Start a timer to move a task here.</p>
            </>
          )}
          {activeTab === 'COMPLETED' && (
            <>
              <CheckCircle2 size={40} className="text-gray-200 dark:text-gray-600 mb-3" />
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No completed tasks yet</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Check off tasks as you finish them.</p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {displayedTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              categories={categories}
              onEdit={setEditingTask}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {editingTask && (
        <TaskModal
          task={editingTask}
          onClose={() => setEditingTask(null)}
          onSuccess={() => setEditingTask(null)}
        />
      )}
      {showAddTask && (
        <TaskModal
          initialDate={dateStr}
          onClose={() => setShowAddTask(false)}
          onSuccess={() => setShowAddTask(false)}
        />
      )}
    </div>
  );
}
