import { Pause, Play, Timer } from 'lucide-react';
import { cn } from '../lib/utils';

interface TimerDisplayProps {
  elapsed: number;           // seconds
  remaining: number;         // seconds
  timeToComplete: number;    // minutes
  isRunning: boolean;
  isThisTask: boolean;
  formattedElapsed: string;
  formattedRemaining: string;
  onPlay?: () => void;
  onPause?: () => void;
  size?: 'sm' | 'md';
  className?: string;
}

export default function TimerDisplay({
  elapsed,
  remaining,
  timeToComplete,
  isRunning,
  isThisTask,
  formattedElapsed,
  formattedRemaining,
  onPlay,
  onPause,
  size = 'md',
  className,
}: TimerDisplayProps) {
  const totalSeconds = timeToComplete * 60;
  const progress = totalSeconds > 0
    ? Math.min(1, elapsed / totalSeconds)
    : 0;
  const pct = Math.round(progress * 100);

  const isSmall = size === 'sm';

  return (
    <div className={cn('flex items-center gap-3', className)}>
      {/* Progress ring */}
      <div className="relative flex-shrink-0">
        <svg
          className={cn(isSmall ? 'w-9 h-9' : 'w-12 h-12')}
          viewBox="0 0 48 48"
        >
          <circle
            cx="24"
            cy="24"
            r="20"
            className="fill-none stroke-gray-100 dark:stroke-gray-700"
            strokeWidth="4"
          />
          <circle
            cx="24"
            cy="24"
            r="20"
            className={cn(
              'fill-none transition-all',
              isRunning && isThisTask
                ? 'stroke-primary'
                : elapsed > 0
                ? 'stroke-primary/50'
                : 'stroke-gray-200 dark:stroke-gray-600',
            )}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 20}`}
            strokeDashoffset={`${2 * Math.PI * 20 * (1 - progress)}`}
            transform="rotate(-90 24 24)"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <Timer
            size={isSmall ? 12 : 16}
            className={cn(
              isRunning && isThisTask
                ? 'text-primary'
                : 'text-gray-400 dark:text-gray-500',
            )}
          />
        </div>
      </div>

      {/* Time info */}
      <div className="min-w-0">
        {isThisTask && isRunning ? (
          <>
            <p className={cn('font-mono font-semibold text-primary', isSmall ? 'text-sm' : 'text-base')}>
              {formattedElapsed}
            </p>
            {totalSeconds > 0 && (
              <p className={cn('text-gray-400 dark:text-gray-500 font-mono', isSmall ? 'text-xs' : 'text-xs')}>
                {formattedRemaining} left
              </p>
            )}
          </>
        ) : (
          <>
            <p className={cn('font-mono font-medium text-gray-600 dark:text-gray-300', isSmall ? 'text-sm' : 'text-base')}>
              {formattedElapsed}
            </p>
            {pct > 0 && (
              <p className={cn('text-gray-400 dark:text-gray-500', isSmall ? 'text-xs' : 'text-xs')}>
                {pct}% done
              </p>
            )}
          </>
        )}
      </div>

      {/* Control button */}
      {(onPlay || onPause) && (
        <button
          onClick={isThisTask && isRunning ? onPause : onPlay}
          className={cn(
            'flex-shrink-0 rounded-full flex items-center justify-center transition-colors',
            isSmall ? 'w-7 h-7' : 'w-9 h-9',
            isThisTask && isRunning
              ? 'bg-primary text-white hover:bg-primary-600'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-primary/10 hover:text-primary',
          )}
          title={isThisTask && isRunning ? 'Pause timer' : 'Start timer'}
        >
          {isThisTask && isRunning ? (
            <Pause size={isSmall ? 12 : 14} />
          ) : (
            <Play size={isSmall ? 12 : 14} />
          )}
        </button>
      )}
    </div>
  );
}
