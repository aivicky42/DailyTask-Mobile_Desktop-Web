import React, { useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useTimerStore } from '../store/timerStore';
import { useTimer } from '../hooks/useTimer';
import { useQuery } from '@tanstack/react-query';
import { getTaskOccurrences } from '../api/client';
import { COLORS } from '../constants/colors';
import { useAppTheme } from '../hooks/useAppTheme';

export default function TimerBanner() {
  const { activeTaskId, isRunning } = useTimerStore();
  const theme = useAppTheme();

  const { elapsed, compactElapsed, pause } = useTimer();
  const [isPausing, setIsPausing] = React.useState(false);

  const { data: tasks } = useQuery({
    queryKey: ['task-occurrences', 'today'],
    queryFn: () => getTaskOccurrences({ date: new Date().toISOString().split('T')[0] }),
    enabled: !!activeTaskId,
  });

  const activeTask = tasks?.find((t) => t.id === activeTaskId);

  const handlePause = useCallback(async () => {
    setIsPausing(true);
    try {
      await pause();
    } finally {
      setIsPausing(false);
    }
  }, [pause]);

  if (!isRunning || !activeTaskId) return null;

  const duration = activeTask?.time_to_complete ?? 0;
  const progress = duration > 0 ? Math.min(elapsed / duration, 1) : 0;
  const remaining = Math.max(0, duration - elapsed);
  const remainingMins = Math.ceil(remaining / 60);

  return (
    <View style={[styles.container, { backgroundColor: COLORS.primary }]}>
      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>

      <View style={styles.content}>
        {/* Left: task info */}
        <View style={styles.info}>
          <View style={styles.pulsingDot} />
          <View style={{ flex: 1 }}>
            <Text style={styles.taskTitle} numberOfLines={1}>
              {activeTask?.title ?? 'Task in progress'}
            </Text>
            <Text style={styles.subtitle}>
              {compactElapsed} elapsed
              {duration > 0 ? ` · ${remainingMins}m left` : ''}
            </Text>
          </View>
        </View>

        {/* Right: pause button */}
        <TouchableOpacity
          style={styles.pauseBtn}
          onPress={handlePause}
          disabled={isPausing}
          activeOpacity={0.8}
        >
          {isPausing ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : (
            <View style={styles.pauseIcon}>
              <View style={styles.pauseBar} />
              <View style={styles.pauseBar} />
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    zIndex: 100,
  },
  progressTrack: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  progressFill: {
    height: 3,
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  info: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pulsingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
    opacity: 1,
  },
  taskTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    marginTop: 1,
  },
  pauseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pauseIcon: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  pauseBar: {
    width: 3,
    height: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
  },
});
