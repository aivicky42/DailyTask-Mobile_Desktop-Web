import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  formatDateISO, formatDate, formatTime12, minutesToHM, parseISO,
  startOfMonth, endOfMonth,
} from '../lib/utils';
import { cn } from '../lib/utils';
import { addDays } from '../lib/utils';
import { getTaskOccurrences, getCategories } from '../api/client';
import CalendarGrid from '../components/CalendarGrid';
import TaskCard from '../components/TaskCard';
import TaskModal from '../components/TaskModal';
import type { TaskOccurrence } from '../types';
import { CalendarDays, ListTodo } from 'lucide-react';

function addMonths(date: Date, n: number) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}

export default function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => formatDateISO(new Date()));
  const [editingTask, setEditingTask] = useState<TaskOccurrence | null>(null);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);

  // Fetch all tasks for the visible month range
  const { data: monthTasks = [], isLoading: monthLoading } = useQuery({
    queryKey: ['task-occurrences', { start_date: formatDateISO(monthStart), end_date: formatDateISO(monthEnd) }],
    queryFn: () =>
      getTaskOccurrences({
        start_date: formatDateISO(monthStart),
        end_date: formatDateISO(monthEnd),
      }),
    staleTime: 30_000,
  });

  // Fetch tasks for selected date
  const { data: dayTasks = [], isLoading: dayLoading } = useQuery({
    queryKey: ['task-occurrences', { date: selectedDate }],
    queryFn: () => getTaskOccurrences({ date: selectedDate }),
    staleTime: 15_000,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
    staleTime: 300_000,
  });

  const prevMonth = () => setCurrentMonth((m) => addMonths(m, -1));
  const nextMonth = () => setCurrentMonth((m) => addMonths(m, 1));

  const handleSelectDate = (date: string) => {
    setSelectedDate(date);
  };

  // Stats for selected day
  const completedToday = dayTasks.filter((t) => t.status === 'COMPLETED').length;
  const totalToday = dayTasks.length;

  const isSelectedToday = selectedDate === formatDateISO(new Date());

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Calendar</h1>
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">
          View and manage tasks across time
        </p>
      </div>

      {/* Calendar */}
      {monthLoading ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 h-80 animate-pulse" />
      ) : (
        <CalendarGrid
          tasks={monthTasks}
          categories={categories}
          selectedDate={selectedDate}
          onSelectDate={handleSelectDate}
          currentMonth={currentMonth}
          onPrevMonth={prevMonth}
          onNextMonth={nextMonth}
        />
      )}

      {/* Selected day tasks */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CalendarDays size={18} className="text-primary" />
            <h2 className="font-semibold text-gray-900 dark:text-white">
              {isSelectedToday ? 'Today' : formatDate(parseISO(selectedDate))}
            </h2>
            {totalToday > 0 && (
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                {completedToday}/{totalToday} done
              </span>
            )}
          </div>
        </div>

        {dayLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-28 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
            ))}
          </div>
        ) : dayTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
            <ListTodo size={36} className="text-gray-200 dark:text-gray-600 mb-3" />
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
              No tasks on this day
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Click the + button to add one
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {dayTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                categories={categories}
                onEdit={setEditingTask}
              />
            ))}
          </div>
        )}
      </div>

      {/* Edit task modal */}
      {editingTask && (
        <TaskModal
          task={editingTask}
          initialDate={selectedDate}
          onClose={() => setEditingTask(null)}
          onSuccess={() => setEditingTask(null)}
        />
      )}
    </div>
  );
}
