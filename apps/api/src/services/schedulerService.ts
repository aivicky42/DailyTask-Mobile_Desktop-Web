import cron from 'node-cron';
import Database from 'better-sqlite3';
import { getDatabase, todayString } from '../db/database';

// ─── Date utilities ───────────────────────────────────────────────────────────

/** Returns day-of-week as 0-6 (Sun=0) for a 'YYYY-MM-DD' string. */
function weekdayOf(dateStr: string): number {
  return new Date(`${dateStr}T00:00:00`).getDay();
}

/** Returns day-of-month (1-31) for a 'YYYY-MM-DD' string. */
function dayOfMonthOf(dateStr: string): number {
  return new Date(`${dateStr}T00:00:00`).getDate();
}

/**
 * Returns the abbreviated weekday name used in `custom_days` columns.
 * e.g.  'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'
 */
function abbreviatedDay(dateStr: string): string {
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
  return DAYS[weekdayOf(dateStr)];
}

// ─── Core insertion helper ────────────────────────────────────────────────────

interface TemplateRow {
  id: string;
  owner_id: string | null;
  category_id: string;
  title: string;
  description: string | null;
  start_time: string;
  time_to_complete: number;
  reminder_enabled: number; // SQLite integer bool
  start_date: string;
}

/**
 * Insert a task occurrence from a template for `date` if one does not
 * already exist (idempotent).
 */
function insertOccurrenceIfNotExists(
  db: Database.Database,
  template: TemplateRow,
  date: string,
): void {
  const exists = db
    .prepare(`
      SELECT id FROM task_occurrences
      WHERE task_template_id = ? AND date = ? AND deleted_at IS NULL
    `)
    .get(template.id, date);

  if (exists) return;

  const id = crypto.randomUUID();

  db.prepare(`
    INSERT INTO task_occurrences (
      id, owner_id, task_template_id, date, title, description,
      category_id, start_time, time_to_complete, status,
      elapsed_time, reminder_enabled, is_detached, sync_version
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'TODO', 0, ?, 0, 1)
  `).run(
    id,
    template.owner_id,
    template.id,
    date,
    template.title,
    template.description,
    template.category_id,
    template.start_time,
    template.time_to_complete,
    template.reminder_enabled, // keep as 0/1
  );
}

// ─── Main generation logic ────────────────────────────────────────────────────

/**
 * Generate task occurrences for `targetDate` according to all active templates.
 * Safe to call multiple times (idempotent due to INSERT guard above).
 *
 * Generation rules:
 *  1. DAILY tasks          – recurrence_type = 'DAILY' OR
 *                            recurrence_type = 'RECURRING' + interval = 'DAILY'
 *  2. WEEKLY tasks         – recurrence_type = 'RECURRING' + interval = 'WEEKLY'
 *                            where template's start_date weekday == today's weekday
 *  3. MONTHLY tasks        – recurrence_type = 'RECURRING' + interval = 'MONTHLY'
 *                            where template's start_date day-of-month == today's
 *  4. CUSTOM / due-date    – recurrence_type = 'CUSTOM' + due_date set
 *                            carry forward until completed or due_date passed
 *  5. CUSTOM / weekday     – recurrence_type = 'CUSTOM' + custom_days set
 *                            generate when today's abbreviated day is in the list
 */
export function generateOccurrencesForDate(targetDate: string): void {
  const db = getDatabase();
  const abbr = abbreviatedDay(targetDate);
  const dom = dayOfMonthOf(targetDate);
  const dow = weekdayOf(targetDate);

  const generate = db.transaction(() => {
    // ── 1. DAILY ────────────────────────────────────────────────────────────
    const daily = db.prepare(`
      SELECT * FROM task_templates
      WHERE (
        recurrence_type = 'DAILY'
        OR (recurrence_type = 'RECURRING' AND recurrence_interval = 'DAILY')
      )
      AND start_date <= ?
      AND (due_date IS NULL OR due_date >= ?)
      AND deleted_at IS NULL
    `).all(targetDate, targetDate) as TemplateRow[];

    for (const t of daily) insertOccurrenceIfNotExists(db, t, targetDate);

    // ── 2. WEEKLY ───────────────────────────────────────────────────────────
    const weekly = db.prepare(`
      SELECT * FROM task_templates
      WHERE recurrence_type = 'RECURRING'
        AND recurrence_interval = 'WEEKLY'
        AND start_date <= ?
        AND (due_date IS NULL OR due_date >= ?)
        AND deleted_at IS NULL
    `).all(targetDate, targetDate) as (TemplateRow & { start_date: string })[];

    for (const t of weekly) {
      if (weekdayOf(t.start_date) === dow) {
        insertOccurrenceIfNotExists(db, t, targetDate);
      }
    }

    // ── 3. MONTHLY ──────────────────────────────────────────────────────────
    const monthly = db.prepare(`
      SELECT * FROM task_templates
      WHERE recurrence_type = 'RECURRING'
        AND recurrence_interval = 'MONTHLY'
        AND start_date <= ?
        AND (due_date IS NULL OR due_date >= ?)
        AND deleted_at IS NULL
    `).all(targetDate, targetDate) as (TemplateRow & { start_date: string })[];

    for (const t of monthly) {
      if (dayOfMonthOf(t.start_date) === dom) {
        insertOccurrenceIfNotExists(db, t, targetDate);
      }
    }

    // ── 4. CUSTOM with due_date – carry forward ──────────────────────────────
    const customDue = db.prepare(`
      SELECT * FROM task_templates
      WHERE recurrence_type = 'CUSTOM'
        AND due_date IS NOT NULL
        AND due_date >= ?
        AND start_date <= ?
        AND deleted_at IS NULL
    `).all(targetDate, targetDate) as TemplateRow[];

    for (const t of customDue) {
      // Only carry forward if never completed
      const completedRow = db
        .prepare(`
          SELECT id FROM task_occurrences
          WHERE task_template_id = ?
            AND status = 'COMPLETED'
            AND deleted_at IS NULL
        `)
        .get(t.id);

      if (!completedRow) insertOccurrenceIfNotExists(db, t, targetDate);
    }

    // ── 5. CUSTOM weekday ────────────────────────────────────────────────────
    const customWeekday = db.prepare(`
      SELECT * FROM task_templates
      WHERE recurrence_type = 'CUSTOM'
        AND custom_days IS NOT NULL
        AND start_date <= ?
        AND (due_date IS NULL OR due_date >= ?)
        AND deleted_at IS NULL
    `).all(targetDate, targetDate) as (TemplateRow & { custom_days: string })[];

    for (const t of customWeekday) {
      const days = t.custom_days
        .split(',')
        .map((d: string) => d.trim());
      if (days.includes(abbr)) {
        insertOccurrenceIfNotExists(db, t, targetDate);
      }
    }
  });

  generate();

  console.log(`[Scheduler] Generated occurrences for ${targetDate}`);
}

// ─── Cron registration ────────────────────────────────────────────────────────

/**
 * Start the midnight scheduler.  Fires at 00:00 server local time every day
 * and generates task occurrences for the new day.
 */
export function startMidnightScheduler(): void {
  cron.schedule('0 0 * * *', () => {
    const today = todayString();
    console.log(`[Scheduler] Midnight rollover — generating tasks for ${today}`);
    try {
      generateOccurrencesForDate(today);
    } catch (err) {
      console.error('[Scheduler] Error generating tasks:', err);
    }
  });

  console.log('[Scheduler] Midnight scheduler active (fires at 00:00 daily)');
}
