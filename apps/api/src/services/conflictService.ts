import { getDatabase } from '../db/database';
import { ConflictCheckInput, ConflictCheckResult } from '../types';

/**
 * Convert a time string ('HH:MM' or 'HH:MM:SS') to minutes from midnight.
 */
function timeToMinutes(time: string): number {
  const parts = time.split(':');
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}

/**
 * Convert minutes from midnight back to 'HH:MM:SS' string.
 */
function minutesToTimeStr(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
}

/**
 * Check whether a proposed time block overlaps any existing task occurrences
 * on the same date.
 *
 * Overlap condition:
 *   new_start  < existing_end
 *   new_end    > existing_start
 *
 * Completed tasks are excluded because they no longer occupy their time slot
 * for practical scheduling purposes.
 */
export function checkConflict(input: ConflictCheckInput): ConflictCheckResult {
  const db = getDatabase();
  const { date, start_time, time_to_complete, exclude_id } = input;

  const newStart = timeToMinutes(start_time);
  const newEnd = newStart + time_to_complete;

  const conditions = [
    'date = ?',
    'deleted_at IS NULL',
    "status != 'COMPLETED'",
  ];
  const params: (string | number)[] = [date];

  if (exclude_id) {
    conditions.push('id != ?');
    params.push(exclude_id);
  }

  const rows = db
    .prepare(
      `SELECT * FROM task_occurrences WHERE ${conditions.join(' AND ')}`,
    )
    .all(...params) as Record<string, unknown>[];

  const conflicting = rows.filter((row) => {
    const existingStart = timeToMinutes(row['start_time'] as string);
    const existingEnd = existingStart + (row['time_to_complete'] as number);
    return newStart < existingEnd && newEnd > existingStart;
  });

  return {
    has_conflict: conflicting.length > 0,
    conflicting_tasks: conflicting.map((row) => {
      const startMins = timeToMinutes(row['start_time'] as string);
      const endMins   = startMins + (row['time_to_complete'] as number);
      return {
        id:         row['id']    as string,
        title:      row['title'] as string,
        start_time: row['start_time'] as string,
        end_time:   minutesToTimeStr(endMins),
      };
    }),
  };
}
