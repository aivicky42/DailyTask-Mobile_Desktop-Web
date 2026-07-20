import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isToday,
  isSameMonth,
  isSameDay,
  addDays,
  subDays,
  formatDateISO,
  formatMonthYear,
} from '../lib/utils';
import { cn } from '../lib/utils';
import type { TaskOccurrence, Category } from '../types';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface CalendarGridProps {
  tasks: TaskOccurrence[];
  categories: Category[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
  currentMonth: Date;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}

export default function CalendarGrid({
  tasks,
  categories,
  selectedDate,
  onSelectDate,
  currentMonth,
  onPrevMonth,
  onNextMonth,
}: CalendarGridProps) {
  // Build grid: pad to full weeks
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  // Group tasks by date
  const tasksByDate: Record<string, TaskOccurrence[]> = {};
  for (const task of tasks) {
    if (!tasksByDate[task.date]) tasksByDate[task.date] = [];
    tasksByDate[task.date].push(task);
  }

  // Get category color by id
  const catMap = new Map(categories.map((c) => [c.id, c]));

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
      {/* Month header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
        <button
          onClick={onPrevMonth}
          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
          aria-label="Previous month"
        >
          <ChevronLeft size={18} />
        </button>
        <h2 className="font-semibold text-gray-900 dark:text-white">
          {formatMonthYear(currentMonth)}
        </h2>
        <button
          onClick={onNextMonth}
          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
          aria-label="Next month"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Weekday labels */}
      <div className="grid grid-cols-7 border-b border-gray-100 dark:border-gray-700">
        {WEEKDAY_LABELS.map((d) => (
          <div
            key={d}
            className="py-2.5 text-center text-xs font-medium text-gray-400 dark:text-gray-500"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Calendar days */}
      <div className="grid grid-cols-7">
        {days.map((day, idx) => {
          const dateStr = formatDateISO(day);
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isSelected = dateStr === selectedDate;
          const isDayToday = isToday(day);
          const dayTasks = tasksByDate[dateStr] ?? [];

          // Unique category colors for this day (max 3 dots)
          const catColors = [
            ...new Set(dayTasks.map((t) => catMap.get(t.category_id)?.color_hex ?? '#6B7280')),
          ].slice(0, 3);

          return (
            <button
              key={dateStr}
              onClick={() => onSelectDate(dateStr)}
              className={cn(
                'relative min-h-[64px] p-2 text-left border-r border-b border-gray-50 dark:border-gray-700/50 transition-colors focus:outline-none',
                // last column: no right border
                (idx + 1) % 7 === 0 && 'border-r-0',
                isCurrentMonth
                  ? 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  : 'bg-gray-50/50 dark:bg-gray-900/30',
                isSelected && 'bg-primary/5 dark:bg-primary/10 hover:bg-primary/5 dark:hover:bg-primary/10',
              )}
            >
              {/* Day number */}
              <span
                className={cn(
                  'inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-medium leading-none',
                  isCurrentMonth
                    ? 'text-gray-700 dark:text-gray-200'
                    : 'text-gray-300 dark:text-gray-600',
                  isDayToday && !isSelected && 'bg-primary text-white',
                  isSelected && !isDayToday && 'bg-primary text-white',
                  isSelected && isDayToday && 'bg-primary text-white ring-2 ring-primary/30',
                )}
              >
                {format(day, 'd')}
              </span>

              {/* Task dots */}
              {catColors.length > 0 && (
                <div className="flex items-center gap-0.5 mt-1.5 flex-wrap">
                  {catColors.map((color, i) => (
                    <span
                      key={i}
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                  {dayTasks.length > 3 && (
                    <span className="text-[9px] text-gray-400 leading-none">
                      +{dayTasks.length - 3}
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
