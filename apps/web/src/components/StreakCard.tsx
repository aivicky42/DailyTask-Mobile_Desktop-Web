import { cn } from '../lib/utils';
import type { DashboardStreaks } from '../types';

interface StreakCardProps {
  streaks: DashboardStreaks | undefined;
  isLoading?: boolean;
}

export default function StreakCard({ streaks, isLoading }: StreakCardProps) {
  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5 animate-pulse">
        <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded mb-3" />
        <div className="flex gap-6">
          <div className="h-10 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="h-10 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
    );
  }

  const current = streaks?.current_streak ?? 0;
  const longest = streaks?.longest_streak ?? 0;
  const isOnFire = current >= 3;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5">
      <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4">Your Streaks</p>

      <div className="flex items-center gap-8">
        {/* Current streak */}
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                'text-3xl font-bold',
                current > 0 ? 'text-orange-500' : 'text-gray-300 dark:text-gray-600',
              )}
            >
              {current}
            </span>
            <span
              className={cn(
                'text-2xl transition-all',
                isOnFire ? 'animate-pulse-slow' : 'opacity-30',
              )}
              title={isOnFire ? 'You\'re on fire!' : 'Keep going!'}
            >
              🔥
            </span>
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
            Current Streak
          </span>
        </div>

        <div className="w-px h-12 bg-gray-100 dark:bg-gray-700" />

        {/* Longest streak */}
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-1.5">
            <span className="text-3xl font-bold text-primary">{longest}</span>
            <span className="text-2xl opacity-70">🏆</span>
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
            Longest Streak
          </span>
        </div>
      </div>

      {current === 0 && (
        <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
          Complete a task today to start your streak!
        </p>
      )}
      {current === 1 && (
        <p className="mt-3 text-xs text-primary/80">
          Great start! Keep it up tomorrow.
        </p>
      )}
      {isOnFire && (
        <p className="mt-3 text-xs text-orange-500 font-medium">
          🎉 {current} day streak — you're crushing it!
        </p>
      )}
    </div>
  );
}
