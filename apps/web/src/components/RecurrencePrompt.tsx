import { useState } from 'react';
import { X, CalendarDays, Repeat, Zap } from 'lucide-react';
import { cn } from '../lib/utils';
import type { DeleteScope } from '../types';

interface RecurrencePromptProps {
  isOpen: boolean;
  action: 'edit' | 'delete';
  taskTitle: string;
  onClose: () => void;
  onConfirm: (scope: DeleteScope, dateRange?: { start: string; end: string }) => void;
}

export default function RecurrencePrompt({
  isOpen,
  action,
  taskTitle,
  onClose,
  onConfirm,
}: RecurrencePromptProps) {
  const [selected, setSelected] = useState<DeleteScope>('SINGLE');
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');

  if (!isOpen) return null;

  const options: { value: DeleteScope; label: string; description: string; icon: React.ReactNode }[] = [
    {
      value: 'SINGLE',
      label: 'This day only',
      description: 'Only affects the selected occurrence',
      icon: <CalendarDays size={18} />,
    },
    {
      value: 'RANGE',
      label: 'Date range',
      description: 'Affects all occurrences within a date range',
      icon: <CalendarDays size={18} />,
    },
    {
      value: 'ALL_RECURRING',
      label: 'All recurring',
      description: 'Affects this and all future occurrences',
      icon: <Repeat size={18} />,
    },
  ];

  const handleConfirm = () => {
    if (selected === 'RANGE') {
      if (!rangeStart || !rangeEnd) return;
      onConfirm('RANGE', { start: rangeStart, end: rangeEnd });
    } else {
      onConfirm(selected);
    }
  };

  const verb = action === 'delete' ? 'Delete' : 'Edit';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md p-6 z-10">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Zap size={18} className="text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {verb} Recurring Task
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-[260px]">
              "{taskTitle}"
            </p>
          </div>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
          Choose how to apply this {action}:
        </p>

        <div className="space-y-2 mb-4">
          {options.map((opt) => (
            <label
              key={opt.value}
              className={cn(
                'flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors',
                selected === opt.value
                  ? 'border-primary bg-primary/5 dark:bg-primary/10'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600',
              )}
            >
              <input
                type="radio"
                name="scope"
                value={opt.value}
                checked={selected === opt.value}
                onChange={() => setSelected(opt.value)}
                className="sr-only"
              />
              <div className={cn(
                'flex-shrink-0',
                selected === opt.value ? 'text-primary' : 'text-gray-400',
              )}>
                {opt.icon}
              </div>
              <div className="min-w-0">
                <p className={cn(
                  'text-sm font-medium',
                  selected === opt.value
                    ? 'text-primary'
                    : 'text-gray-800 dark:text-gray-200',
                )}>
                  {opt.label}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{opt.description}</p>
              </div>
              <div className={cn(
                'ml-auto w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center',
                selected === opt.value
                  ? 'border-primary'
                  : 'border-gray-300 dark:border-gray-600',
              )}>
                {selected === opt.value && (
                  <div className="w-2 h-2 rounded-full bg-primary" />
                )}
              </div>
            </label>
          ))}
        </div>

        {/* Date range inputs */}
        {selected === 'RANGE' && (
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                From
              </label>
              <input
                type="date"
                value={rangeStart}
                onChange={(e) => setRangeStart(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                To
              </label>
              <input
                type="date"
                value={rangeEnd}
                min={rangeStart}
                onChange={(e) => setRangeEnd(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={selected === 'RANGE' && (!rangeStart || !rangeEnd)}
            className={cn(
              'flex-1 px-4 py-2.5 rounded-xl text-white text-sm font-medium transition-colors',
              action === 'delete'
                ? 'bg-red-500 hover:bg-red-600 disabled:bg-red-300'
                : 'bg-primary hover:bg-primary-600 disabled:bg-primary/50',
            )}
          >
            {verb}
          </button>
        </div>
      </div>
    </div>
  );
}
