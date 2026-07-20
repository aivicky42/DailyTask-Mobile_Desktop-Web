import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface TimerState {
  activeSessionId: string | null;
  activeTaskId: string | null;
  sessionStartTime: string | null; // ISO string (serialisable for localStorage)
  savedElapsed: number;            // seconds accumulated before this session
  isRunning: boolean;

  // Actions
  startTimer: (
    sessionId: string,
    taskId: string,
    startTime: Date,
    savedElapsed: number,
  ) => void;
  pauseTimer: () => void;
  clearTimer: () => void;

  // Computed – reads store snapshot, usable outside React render
  getCurrentElapsed: () => number;
}

export const useTimerStore = create<TimerState>()(
  persist(
    (set, get) => ({
      activeSessionId: null,
      activeTaskId: null,
      sessionStartTime: null,
      savedElapsed: 0,
      isRunning: false,

      startTimer(sessionId, taskId, startTime, savedElapsed) {
        set({
          activeSessionId: sessionId,
          activeTaskId: taskId,
          sessionStartTime: startTime.toISOString(),
          savedElapsed,
          isRunning: true,
        });
      },

      pauseTimer() {
        const elapsed = get().getCurrentElapsed();
        set({
          isRunning: false,
          activeSessionId: null,
          sessionStartTime: null,
          savedElapsed: elapsed,
        });
      },

      clearTimer() {
        set({
          activeSessionId: null,
          activeTaskId: null,
          sessionStartTime: null,
          savedElapsed: 0,
          isRunning: false,
        });
      },

      getCurrentElapsed() {
        const { savedElapsed, sessionStartTime, isRunning } = get();
        if (!isRunning || !sessionStartTime) return savedElapsed;
        const sessionSeconds = Math.floor(
          (Date.now() - new Date(sessionStartTime).getTime()) / 1000,
        );
        return savedElapsed + Math.max(0, sessionSeconds);
      },
    }),
    {
      name: 'dailytask-timer',
      // Only persist what we need to restore state across page refreshes
      partialize: (state) => ({
        activeSessionId: state.activeSessionId,
        activeTaskId: state.activeTaskId,
        sessionStartTime: state.sessionStartTime,
        savedElapsed: state.savedElapsed,
        isRunning: state.isRunning,
      }),
    },
  ),
);
