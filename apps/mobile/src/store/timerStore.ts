import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface TimerState {
  /** Backend session id */
  activeSessionId: string | null;
  /** Task occurrence id being timed */
  activeTaskId: string | null;
  /** ISO string: when the current play segment started */
  sessionStartTime: string | null;
  /** Seconds already accrued in previous play segments */
  savedElapsed: number;
  /** Whether the timer is currently counting */
  isRunning: boolean;

  startTimer: (
    sessionId: string,
    taskId: string,
    startTime: string,
    savedElapsed: number
  ) => void;
  pauseTimer: () => void;
  clearTimer: () => void;
}

export const useTimerStore = create<TimerState>()(
  persist(
    (set) => ({
      activeSessionId: null,
      activeTaskId: null,
      sessionStartTime: null,
      savedElapsed: 0,
      isRunning: false,

      startTimer: (sessionId, taskId, startTime, savedElapsed) =>
        set({
          activeSessionId: sessionId,
          activeTaskId: taskId,
          sessionStartTime: startTime,
          savedElapsed,
          isRunning: true,
        }),

      pauseTimer: () =>
        set((state) => {
          const extra =
            state.sessionStartTime && state.isRunning
              ? Math.floor(
                  (Date.now() - new Date(state.sessionStartTime).getTime()) / 1000
                )
              : 0;
          return {
            isRunning: false,
            sessionStartTime: null,
            savedElapsed: state.savedElapsed + extra,
          };
        }),

      clearTimer: () =>
        set({
          activeSessionId: null,
          activeTaskId: null,
          sessionStartTime: null,
          savedElapsed: 0,
          isRunning: false,
        }),
    }),
    {
      name: 'dailytask-timer',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
