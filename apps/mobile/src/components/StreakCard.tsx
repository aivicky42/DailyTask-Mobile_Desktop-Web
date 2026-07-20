import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { DashboardStreaks } from '../types';
import { COLORS } from '../constants/colors';
import { useAppTheme } from '../hooks/useAppTheme';
import { formatDate } from '../lib/utils';

interface Props {
  streaks: DashboardStreaks;
}

export default function StreakCard({ streaks }: Props) {
  const theme = useAppTheme();
  const { current_streak, longest_streak, last_completed_date } = streaks;

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      {/* Fire emoji + current streak */}
      <View style={styles.mainSection}>
        <Text style={styles.fireEmoji}>🔥</Text>
        <View>
          <Text style={[styles.streakNumber, { color: theme.text }]}>{current_streak}</Text>
          <Text style={[styles.streakLabel, { color: theme.textSecondary }]}>day streak</Text>
        </View>
        {current_streak > 0 && (
          <View style={[styles.activeBadge, { backgroundColor: COLORS.warning + '20' }]}>
            <Text style={[styles.activeBadgeText, { color: COLORS.warning }]}>Active</Text>
          </View>
        )}
      </View>

      {/* Divider */}
      <View style={[styles.divider, { backgroundColor: theme.border }]} />

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={[styles.statValue, { color: COLORS.primary }]}>{longest_streak}</Text>
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Best streak</Text>
        </View>

        {last_completed_date && (
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: theme.text }]}>
              {formatDate(last_completed_date)}
            </Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Last completed</Text>
          </View>
        )}

        <View style={styles.stat}>
          <View style={styles.flameRow}>
            {Array.from({ length: Math.min(current_streak, 7) }).map((_, i) => (
              <Text key={i} style={styles.miniFlame}>
                🔥
              </Text>
            ))}
          </View>
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>This week</Text>
        </View>
      </View>

      {/* Motivational message */}
      {current_streak === 0 && (
        <View style={[styles.motivation, { backgroundColor: COLORS.primary + '10' }]}>
          <Text style={[styles.motivationText, { color: COLORS.primary }]}>
            Complete a task today to start your streak! 💪
          </Text>
        </View>
      )}
      {current_streak >= 7 && (
        <View style={[styles.motivation, { backgroundColor: COLORS.warning + '10' }]}>
          <Text style={[styles.motivationText, { color: COLORS.warning }]}>
            Amazing! {current_streak} day streak — keep it going! 🏆
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  mainSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  fireEmoji: {
    fontSize: 36,
  },
  streakNumber: {
    fontSize: 32,
    fontWeight: '800',
    lineHeight: 36,
  },
  streakLabel: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 1,
  },
  activeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    marginLeft: 'auto',
  },
  activeBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stat: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  flameRow: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  miniFlame: {
    fontSize: 12,
  },
  motivation: {
    marginTop: 12,
    borderRadius: 10,
    padding: 10,
  },
  motivationText: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
});
