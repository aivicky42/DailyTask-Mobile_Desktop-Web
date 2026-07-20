import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { BarChart, LineChart } from 'react-native-gifted-charts';
import { format, parseISO } from 'date-fns';
import { TimeSpentEntry, CompletionRateEntry } from '../types';
import { COLORS } from '../constants/colors';
import { useAppTheme } from '../hooks/useAppTheme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - 64;

// ─── Time Spent Bar Chart ─────────────────────────────────────────────────────

interface TimeSpentChartProps {
  data: TimeSpentEntry[];
}

export function TimeSpentChart({ data }: TimeSpentChartProps) {
  const theme = useAppTheme();

  const barData = data.map((entry) => ({
    value: Math.round(entry.total_seconds / 60), // convert to minutes
    label: format(parseISO(entry.date), 'EEE'),
    frontColor: COLORS.primary,
    topLabelComponent: () => {
      const mins = Math.round(entry.total_seconds / 60);
      if (mins === 0) return null;
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return (
        <Text style={{ fontSize: 9, color: theme.textMuted, marginBottom: 2 }}>
          {h > 0 ? `${h}h` : `${m}m`}
        </Text>
      );
    },
  }));

  const maxVal = Math.max(...data.map((d) => Math.round(d.total_seconds / 60)), 60);

  return (
    <View style={styles.chartWrapper}>
      <BarChart
        data={barData}
        width={CHART_WIDTH - 40}
        barWidth={CHART_WIDTH / (data.length * 2.5)}
        barBorderRadius={6}
        noOfSections={4}
        maxValue={maxVal}
        yAxisThickness={0}
        xAxisThickness={StyleSheet.hairlineWidth}
        xAxisColor={theme.border}
        yAxisColor={theme.border}
        xAxisLabelTextStyle={{ color: theme.textMuted, fontSize: 11 }}
        yAxisTextStyle={{ color: theme.textMuted, fontSize: 11 }}
        hideRules
        isAnimated
        animationDuration={600}
        cappedBars
        capColor={COLORS.primaryDark}
        capThickness={3}
      />
    </View>
  );
}

// ─── Completion Rate Line Chart ───────────────────────────────────────────────

interface CompletionRateChartProps {
  data: CompletionRateEntry[];
}

export function CompletionRateChart({ data }: CompletionRateChartProps) {
  const theme = useAppTheme();

  const lineData = data.map((entry) => ({
    value: Math.round(entry.rate * 100),
    label: format(parseISO(entry.date), 'EEE'),
    dataPointText: `${Math.round(entry.rate * 100)}%`,
  }));

  return (
    <View style={styles.chartWrapper}>
      <LineChart
        data={lineData}
        width={CHART_WIDTH - 40}
        height={140}
        color={COLORS.success}
        thickness={2.5}
        startFillColor={COLORS.success}
        startOpacity={0.25}
        endOpacity={0.02}
        noOfSections={4}
        maxValue={100}
        yAxisThickness={0}
        xAxisThickness={StyleSheet.hairlineWidth}
        xAxisColor={theme.border}
        yAxisColor={theme.border}
        xAxisLabelTextStyle={{ color: theme.textMuted, fontSize: 11 }}
        yAxisTextStyle={{ color: theme.textMuted, fontSize: 11 }}
        dataPointsColor={COLORS.success}
        dataPointsRadius={4}
        hideRules
        isAnimated
        animationDuration={600}
        curved
        areaChart
      />
    </View>
  );
}

// ─── Combined Charts Card ─────────────────────────────────────────────────────

interface ChartsProps {
  timeSpent: TimeSpentEntry[];
  completionRate: CompletionRateEntry[];
}

export default function Charts({ timeSpent, completionRate }: ChartsProps) {
  const theme = useAppTheme();

  return (
    <View style={{ gap: 16 }}>
      {/* Time Spent */}
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>Time Spent</Text>
          <Text style={[styles.cardSubtitle, { color: theme.textSecondary }]}>Last 7 days</Text>
        </View>
        {timeSpent.length > 0 ? (
          <TimeSpentChart data={timeSpent} />
        ) : (
          <EmptyChart message="No time tracked yet" />
        )}
      </View>

      {/* Completion Rate */}
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>Completion Rate</Text>
          <Text style={[styles.cardSubtitle, { color: theme.textSecondary }]}>Last 7 days</Text>
        </View>
        {completionRate.length > 0 ? (
          <CompletionRateChart data={completionRate} />
        ) : (
          <EmptyChart message="No data yet" />
        )}
      </View>
    </View>
  );
}

function EmptyChart({ message }: { message: string }) {
  const theme = useAppTheme();
  return (
    <View style={styles.emptyChart}>
      <Text style={styles.emptyIcon}>📊</Text>
      <Text style={[styles.emptyText, { color: theme.textMuted }]}>{message}</Text>
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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  cardSubtitle: {
    fontSize: 12,
    fontWeight: '500',
  },
  chartWrapper: {
    paddingLeft: 4,
  },
  emptyChart: {
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyIcon: {
    fontSize: 28,
    opacity: 0.4,
  },
  emptyText: {
    fontSize: 13,
    fontWeight: '500',
  },
});
