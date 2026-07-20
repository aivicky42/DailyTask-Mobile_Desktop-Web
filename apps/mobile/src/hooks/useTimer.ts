import { useCallback, useEffect, useRef, useState } from 'react';
import { useTimerStore } from '../store/timerStore';
import * as api from '../api/client';
import { formatTime, formatTimerCompact } from '../lib/utils';

export interface UseTimerReturn {
  elapsed: number;
  remaining: number;
  formattedElapsed: string;
  formattedRemaining: string;
  compactElapsed: string;
  isRunning: boolean;
  activeTaskId: string | null;
  play: (taskId: string, currentElapsed: number) => Promise<void>;
  pause: () => Promise<void>;
  clear: () => void;
}

export function useTimer(taskDuration = 0): UseTimerReturn {
  const {
    isRunning,
    sessionStartTime,
    savedElapsed,
    activeTaskId,
    startTimer,
    pauseTimer: storePause,
    clearTimer,
  } = useTimerStore();

  const [elapsed, setElapsed] = useState<number>(savedElapsed);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const getCurrentElapsed = useCallback((): number => {
    if (!isRunning || !sessionStartTime) return savedElapsed;
    const diff = Math.floor(
      (Date.now() - new Date(sessionStartTime).getTime()) / 1000
    );
    return savedElapsed + Math.max(0, diff);
  }, [isRunning, sessionStartTime, savedElapsed]);

  // Tick every second while running
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (isRunning) {
      // Immediate update
      setElapsed(getCurrentElapsed());
      intervalRef.current = setInterval(() => {
        setElapsed(getCurrentElapsed());
      }, 1000);
    } else {
      setElapsed(savedElapsed);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isRunning, getCurrentElapsed, savedElapsed]);

  const remaining = Math.max(0, taskDuration - elapsed);

  const play = useCallback(
    async (taskId: string, currentElapsed: number): Promise<void> => {
      try {
        const session = await api.playTimer(taskId);
        startTimer(session.id, taskId, session.start_time, currentElapsed);
      } catch (error) {
        console.error('[Timer] Failed to start:', error);
        throw error;
      }
    },
    [startTimer]
  );

  const pause = useCallback(async (): Promise<void> => {
    try {
      await api.pauseTimer();
      storePause();
    } catch (error) {
      console.error('[Timer] Failed to pause:', error);
      // Still update local state so UI is consistent
      storePause();
      throw error;
    }
  }, [storePause]);

  return {
    elapsed,
    remaining,
    formattedElapsed: formatTime(elapsed),
    formattedRemaining: formatTime(remaining),
    compactElapsed: formatTimerCompact(elapsed),
    isRunning,
    activeTaskId,
    play,
    pause,
    clear: clearTimer,
  };
}
