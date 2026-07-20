import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  format,
  isSameDay,
  isToday,
  parseISO,
} from 'date-fns';
import { TaskOccurrence, Category } from '../types';
import { COLORS, getCategoryColor } from '../constants/colors';
import { useAppTheme } from '../hooks/useAppTheme';
import { toDateString } from '../lib/utils';

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CELL_SIZE = Math.floor((SCREEN_WIDTH - 48) / 7);

interface Props {
  displayMonth: Date;
  selectedDate: Date;
  tasks: TaskOccurrence[];
  categories: Category[];
  onSelectDate: (date: Date) => void;
}

export default function CalendarGrid({
  displayMonth,
  selectedDate,
  tasks,
  categories,
  onSelectDate,
}: Props) {
  const theme = useAppTheme();

  // Build task map: date string → task list
  const taskMap = useMemo(() => {
    const map = new Map<string, TaskOccurrence[]>();
    tasks.forEach((t) => {
      const key = t.date.split('T')[0];
      const arr = map.get(key) ?? [];
      arr.push(t);
      map.set(key, arr);
    });
    return map;
  }, [tasks]);

  // Build grid days
  const { days, leadingBlanks } = useMemo(() => {
    const start = startOfMonth(displayMonth);
    const end = endOfMonth(displayMonth);
    const days = eachDayOfInterval({ start, end });
    const leadingBlanks = getDay(start); // 0=Sun
    return { days, leadingBlanks };
  }, [displayMonth]);

  const catColorMap = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach((c) => map.set(c.id, c.color_hex || getCategoryColor(c.id)));
    return map;
  }, [categories]);

  return (
    <View>
      {/* Day-of-week header */}
      <View style={styles.header}>
        {DAYS_OF_WEEK.map((d) => (
          <View key={d} style={styles.headerCell}>
            <Text style={[styles.headerText, { color: theme.textMuted }]}>{d}</Text>
          </View>
        ))}
      </View>

      {/* Grid */}
      <View style={styles.grid}>
        {/* Leading blanks */}
        {Array.from({ length: leadingBlanks }).map((_, i) => (
          <View key={`blank-${i}`} style={styles.cell} />
        ))}

        {/* Day cells */}
        {days.map((day) => {
          const key = toDateString(day);
          const dayTasks = taskMap.get(key) ?? [];
          const isSelected = isSameDay(day, selectedDate);
          const isCurrentDay = isToday(day);

          // Get up to 3 unique category colors
          const dots = dayTasks
            .slice(0, 3)
            .map((t) => catColorMap.get(t.category_id) ?? COLORS.primary);

          return (
            <TouchableOpacity
              key={key}
              style={[
                styles.cell,
                isSelected && [styles.selectedCell, { backgroundColor: COLORS.primary }],
                !isSelected && isCurrentDay && [styles.todayCell, { borderColor: COLORS.primary }],
              ]}
              onPress={() => onSelectDate(day)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.dayNumber,
                  { color: theme.text },
                  isSelected && { color: '#FFFFFF' },
                  !isSelected && isCurrentDay && { color: COLORS.primary, fontWeight: '700' },
                ]}
              >
                {format(day, 'd')}
              </Text>

              {/* Task dots */}
              {dots.length > 0 && (
                <View style={styles.dots}>
                  {dots.map((color, i) => (
                    <View
                      key={i}
                      style={[
                        styles.dot,
                        {
                          backgroundColor: isSelected ? 'rgba(255,255,255,0.8)' : color,
                        },
                      ]}
                    />
                  ))}
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  headerCell: {
    width: CELL_SIZE,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 4,
  },
  selectedCell: {
    borderRadius: CELL_SIZE / 2,
  },
  todayCell: {
    borderWidth: 2,
    borderRadius: CELL_SIZE / 2,
  },
  dayNumber: {
    fontSize: 14,
    fontWeight: '500',
  },
  dots: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 3,
    height: 5,
    alignItems: 'center',
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
});
