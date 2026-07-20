import { useState, useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTimerStore } from '../store/timerStore';
import {
  playTimer as apiPlay,
  pauseTimer as apiPause,
  getActiveTimer,
} from '../api/client';
import { formatElapsed } from '../lib/utils';

interface UseTimerReturn {
  elapsed: number;           // total seconds elapsed
  remaining: number;         // seconds remaining (needs timeToComplete)
  isRunning: boolean;
  activeTaskId: string | null;
  formattedElapsed: string;
  formattedRemaining: string;
  play: (taskOccurrenceId: string, savedElapsed: number) => Promise<void>;
  pause: () => Promise<void>;
}

/**
 * Hook for timer logic.
 * @param timeToComplete  Task duration in minutes (optional – used to compute "remaining")
 */
export function useTimer(timeToComplete?: number): UseTimerReturn {
  const qc = useQueryClient();
  const hasCheckedActive = useRef(false);

  const {
    activeTaskId,
    isRunning,
    savedElapsed,
    startTimer,
    pauseTimer: storePause,
    clearTimer,
    getCurrentElapsed,
  } = useTimerStore();

  // Tick state causes re-render every second when timer is running
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [isRunning]);

  // On first mount, sync with any server-side active session
  useEffect(() => {
    if (hasCheckedActive.current || isRunning) return;
    hasCheckedActive.current = true;

    getActiveTimer().then((result) => {
      if (result?.session.is_active) {
        startTimer(
          result.session.id,
          result.session.task_occurrence_id,
          new Date(result.session.start_time),
          result.baseElapsed,
        );
      }
    }).catch(() => {
      // No active session or network error – clear any stale local state
      if (isRunning) clearTimer();
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const elapsed = isRunning ? getCurrentElapsed() : savedElapsed;
  const totalSeconds = (timeToComplete ?? 0) * 60;
  const remaining = totalSeconds > 0 ? Math.max(0, totalSeconds - elapsed) : 0;

  const play = useCallback(
    async (taskOccurrenceId: string, currentSavedElapsed: number) => {
      const session = await apiPlay(taskOccurrenceId);
      startTimer(session.id, taskOccurrenceId, new Date(session.start_time), currentSavedElapsed);
      await qc.invalidateQueries({ queryKey: ['task-occurrences'] });
    },
    [startTimer, qc],
  );

  const pause = useCallback(async () => {
    await apiPause();
    storePause();
    await qc.invalidateQueries({ queryKey: ['task-occurrences'] });
  }, [storePause, qc]);

  return {
    elapsed,
    remaining,
    isRunning,
    activeTaskId,
    formattedElapsed: formatElapsed(elapsed),
    formattedRemaining: formatElapsed(remaining),
    play,
    pause,
  };
}
