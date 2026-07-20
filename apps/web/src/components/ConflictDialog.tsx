import { AlertTriangle, X, Clock } from 'lucide-react';
import { formatTime12 } from '../lib/utils';
import type { ConflictCheck } from '../types';

interface ConflictDialogProps {
  conflict: ConflictCheck;
  onOverride: () => void;
  onReschedule: () => void;
  onClose: () => void;
}

export default function ConflictDialog({
  conflict,
  onOverride,
  onReschedule,
  onClose,
}: ConflictDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md p-6 z-10">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div className="flex items-start gap-4 mb-5">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
            <AlertTriangle size={20} className="text-amber-500" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Schedule Conflict
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              This task overlaps with {conflict.conflicting_tasks.length} existing{' '}
              {conflict.conflicting_tasks.length === 1 ? 'task' : 'tasks'}.
            </p>
          </div>
        </div>

        {/* Conflicting tasks list */}
        <div className="space-y-2 mb-6">
          {conflict.conflicting_tasks.map((t) => (
            <div
              key={t.id}
              className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800/30"
            >
              <Clock size={14} className="text-amber-500 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                  {t.title}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {formatTime12(t.start_time)} – {formatTime12(t.end_time)}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onReschedule}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Reschedule
          </button>
          <button
            onClick={onOverride}
            className="flex-1 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium transition-colors"
          >
            Override Anyway
          </button>
        </div>
      </div>
    </div>
  );
}
