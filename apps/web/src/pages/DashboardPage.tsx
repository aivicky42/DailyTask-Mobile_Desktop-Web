import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format, subDays, formatDateISO, parseISO } from '../lib/utils';
import { formatDate, minutesToHM, formatElapsed } from '../lib/utils';
import {
  getDashboardStreaks,
  getTimeSpent,
  getCompletionRate,
  getTaskOccurrences,
  getCategories,
  generateToday,
} from '../api/client';
import { useTimerStore } from '../store/timerStore';
import { useTimer } from '../hooks/useTimer';
import StreakCard from '../components/StreakCard';
import TaskCard from '../components/TaskCard';
import { TimeSpentChart, CompletionRateChart } from '../components/Charts';
import { useState, useEffect } from 'react';
import TaskModal from '../components/TaskModal';
import type { TaskOccurrence } from '../types';
import { Pause, Zap, ListTodo, CheckCircle2, Clock } from 'lucide-react';
import { cn } from '../lib/utils';

// ── Helpers ──────────────────────────────────────────────────────────────────

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

// ── Active Timer Banner ───────────────────────────────────────────────────────

function ActiveTimerBanner({ tasks, categories }: { tasks: TaskOccurrence[]; categories: ReturnType<typeof Array.prototype.map> }) {
  const { activeTaskId, isRunning, getCurrentElapsed } = useTimerStore();
  const { pause, formattedElapsed } = useTimer();

  if (!isRunning || !activeTaskId) return null;

  const activeTask = tasks.find((t) => t.id === activeTaskId);
  if (!activeTask) return null;

  const totalSecs = activeTask.time_to_complete * 60;
  const elapsed = getCurrentElapsed();
  const remaining = Math.max(0, totalSecs - elapsed);
  const progress = totalSecs > 0 ? Math.min(1, elapsed / totalSecs) : 0;

  return (
    <div className="relative bg-primary rounded-2xl p-4 overflow-hidden">
      {/* Progress stripe */}
      <div
        className="absolute inset-0 bg-primary-700/40 transition-all duration-1000"
        style={{ width: `${Math.round(progress * 100)}%` }}
      />

      <div className="relative flex items-center gap-4">
        {/* Pulse dot */}
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
          <Zap size={18} className="text-white" />
          <span className="absolute w-3 h-3 bg-white rounded-full animate-ping opacity-50 top-0 right-0" />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-white/70 uppercase tracking-wider">Now Working On</p>
          <p className="text-base font-semibold text-white truncate mt-0.5">{activeTask.title}</p>
          <div className="flex items-center gap-3 mt-1 text-white/80 text-sm font-mono">
            <span>{formattedElapsed} elapsed</span>
            {totalSecs > 0 && (
              <>
                <span>·</span>
                <span>{formatElapsed(remaining)} left</span>
              </>
            )}
          </div>
        </div>

        {/* Pause */}
        <button
          onClick={pause}
          className="flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-white text-sm font-medium transition-colors"
        >
          <Pause size={14} />
          Pause
        </button>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const qc = useQueryClient();
  const today = formatDateISO(new Date());
  const sevenDaysAgo = formatDateISO(subDays(new Date(), 6));
  const [editingTask, setEditingTask] = useState<TaskOccurrence | null>(null);

  // Generate today's occurrences from templates on mount, then refresh lists
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await generateToday();
        if (!cancelled) {
          await qc.invalidateQueries({ queryKey: ['task-occurrences'] });
          await qc.invalidateQueries({ queryKey: ['dashboard-streaks'] });
          await qc.invalidateQueries({ queryKey: ['time-spent'] });
          await qc.invalidateQueries({ queryKey: ['completion-rate'] });
        }
      } catch {
        /* silent – non-critical */
      }
    })();
    return () => { cancelled = true; };
  }, [qc]);

  const { data: streaks, isLoading: streaksLoading } = useQuery({
    queryKey: ['dashboard-streaks'],
    queryFn: getDashboardStreaks,
    staleTime: 60_000,
  });

  const { data: timeSpent, isLoading: timeLoading } = useQuery({
    queryKey: ['time-spent', sevenDaysAgo, today],
    queryFn: () => getTimeSpent(sevenDaysAgo, today),
    staleTime: 60_000,
  });

  const { data: completionRate, isLoading: compLoading } = useQuery({
    queryKey: ['completion-rate', sevenDaysAgo, today],
    queryFn: () => getCompletionRate(sevenDaysAgo, today),
    staleTime: 60_000,
  });

  const { data: todayTasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ['task-occurrences', { date: today }],
    queryFn: () => getTaskOccurrences({ date: today }),
    refetchInterval: 30_000,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
    staleTime: 300_000,
  });

  // Quick stats
  const todoCount = todayTasks.filter((t) => t.status === 'TODO').length;
  const inProgressCount = todayTasks.filter((t) => t.status === 'IN_PROGRESS').length;
  const completedCount = todayTasks.filter((t) => t.status === 'COMPLETED').length;
  const completionPct = todayTasks.length > 0
    ? Math.round((completedCount / todayTasks.length) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="text-sm text-gray-400 dark:text-gray-500 font-medium">
          {format(new Date(), 'EEEE, MMMM d')}
        </p>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mt-0.5">
          {getGreeting()} 👋
        </h1>
      </div>

      {/* Active timer banner */}
      <ActiveTimerBanner tasks={todayTasks} categories={categories} />

      {/* Top row: Streak + Quick stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="sm:col-span-2">
          <StreakCard streaks={streaks} isLoading={streaksLoading} />
        </div>

        {/* Quick stats */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-3">
            <ListTodo size={16} className="text-gray-400" />
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Today</span>
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">Total</span>
              <span className="font-semibold text-gray-900 dark:text-white">{todayTasks.length}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">Done</span>
              <span className="font-semibold text-green-500">{completedCount}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">Active</span>
              <span className="font-semibold text-blue-500">{inProgressCount}</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 flex flex-col items-center justify-center">
          <div className="relative w-16 h-16">
            <svg viewBox="0 0 64 64" className="w-full h-full -rotate-90">
              <circle cx="32" cy="32" r="26" fill="none" stroke="currentColor" strokeWidth="6"
                className="text-gray-100 dark:text-gray-700" />
              <circle cx="32" cy="32" r="26" fill="none" stroke="#6366F1" strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 26}`}
                strokeDashoffset={`${2 * Math.PI * 26 * (1 - completionPct / 100)}`}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm font-bold text-gray-900 dark:text-white">{completionPct}%</span>
            </div>
          </div>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 text-center">Completion rate</p>
        </div>
      </div>

      {/* Today's tasks */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900 dark:text-white">Today's Tasks</h2>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {completedCount}/{todayTasks.length} done
          </span>
        </div>

        {tasksLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
            ))}
          </div>
        ) : todayTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
            <CheckCircle2 size={36} className="text-gray-200 dark:text-gray-600 mb-3" />
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No tasks for today</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Use the + button to add one
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {todayTasks.slice(0, 6).map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                categories={categories}
                onEdit={setEditingTask}
                compact
              />
            ))}
            {todayTasks.length > 6 && (
              <p className="text-xs text-center text-gray-400 dark:text-gray-500 pt-1">
                +{todayTasks.length - 6} more — view all in Tasks
              </p>
            )}
          </div>
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Time Spent</h3>
            <span className="text-xs text-gray-400 dark:text-gray-500">Last 7 days · hours</span>
          </div>
          <TimeSpentChart data={timeSpent} isLoading={timeLoading} />
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Completion Rate</h3>
            <span className="text-xs text-gray-400 dark:text-gray-500">Last 7 days · %</span>
          </div>
          <CompletionRateChart data={completionRate} isLoading={compLoading} />
        </div>
      </div>

      {/* Edit task modal */}
      {editingTask && (
        <TaskModal
          task={editingTask}
          onClose={() => setEditingTask(null)}
          onSuccess={() => setEditingTask(null)}
        />
      )}
    </div>
  );
}
