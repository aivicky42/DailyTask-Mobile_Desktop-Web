import { Router, Request, Response, NextFunction } from 'express';
import { getDatabase, toBool } from '../db/database';
import { AppError } from '../middleware/errorHandler';
import { TaskTemplate, RecurrenceType, RecurrenceInterval } from '../types';
import { generateOccurrencesForDate, generateOccurrencesForRange } from '../services/schedulerService';
import { todayString } from '../db/database';

const router = Router();

const VALID_RECURRENCE_TYPES: RecurrenceType[] = ['NONE', 'DAILY', 'RECURRING', 'CUSTOM'];
const VALID_RECURRENCE_INTERVALS: RecurrenceInterval[] = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'];

function rowToTemplate(row: Record<string, unknown>): TaskTemplate {
  return {
    ...(row as Omit<TaskTemplate, 'reminder_enabled'>),
    reminder_enabled: toBool(row['reminder_enabled'] as number),
  };
}

function validateRecurrence(body: Record<string, unknown>, isCreate: boolean): void {
  const { category_id, title, start_date, start_time, time_to_complete, recurrence_type, recurrence_interval } = body;

  if (isCreate) {
    if (!category_id) throw new AppError(400, 'Validation Error', 'category_id is required.');
    if (!title || typeof title !== 'string' || (title as string).trim().length === 0) {
      throw new AppError(400, 'Validation Error', 'title is required and must be non-empty.');
    }
    if (!start_date) throw new AppError(400, 'Validation Error', 'start_date is required (YYYY-MM-DD).');
    if (!start_time) throw new AppError(400, 'Validation Error', 'start_time is required (HH:MM).');
    if (time_to_complete === undefined || time_to_complete === null) {
      throw new AppError(400, 'Validation Error', 'time_to_complete is required (minutes).');
    }
  }

  if (title !== undefined && (title as string).length > 100) {
    throw new AppError(400, 'Validation Error', 'title must be 100 characters or fewer.');
  }
  if (time_to_complete !== undefined && (typeof time_to_complete !== 'number' || (time_to_complete as number) <= 0)) {
    throw new AppError(400, 'Validation Error', 'time_to_complete must be a positive integer (minutes).');
  }
  if (recurrence_type !== undefined && !VALID_RECURRENCE_TYPES.includes(recurrence_type as RecurrenceType)) {
    throw new AppError(400, 'Validation Error', `recurrence_type must be one of: ${VALID_RECURRENCE_TYPES.join(', ')}.`);
  }
  if (recurrence_interval !== undefined && recurrence_interval !== null && !VALID_RECURRENCE_INTERVALS.includes(recurrence_interval as RecurrenceInterval)) {
    throw new AppError(400, 'Validation Error', `recurrence_interval must be one of: ${VALID_RECURRENCE_INTERVALS.join(', ')}.`);
  }
}

// ─── GET /api/v1/task-templates ───────────────────────────────────────────────
router.get('/', (_req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getDatabase();
    const rows = db
      .prepare(`
        SELECT * FROM task_templates
        WHERE deleted_at IS NULL
        ORDER BY created_at DESC
      `)
      .all() as Record<string, unknown>[];

    res.json(rows.map(rowToTemplate));
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/v1/task-templates/generate-today ───────────────────────────────
// Must be registered BEFORE /:id to avoid route collision
router.post('/generate-today', (_req: Request, res: Response, next: NextFunction) => {
  try {
    const today = todayString();
    generateOccurrencesForDate(today);
    res.json({
      message: `Successfully generated task occurrences for ${today}.`,
      date: today,
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/v1/task-templates/generate-range ───────────────────────────────
router.post('/generate-range', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { start_date, end_date } = req.body as { start_date?: string; end_date?: string };
    if (!start_date || !end_date) {
      throw new AppError(400, 'Validation Error', 'start_date and end_date are required (YYYY-MM-DD).');
    }
    generateOccurrencesForRange(start_date, end_date);
    res.json({
      message: `Successfully generated task occurrences for ${start_date}..${end_date}.`,
      start_date,
      end_date,
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/v1/task-templates ─────────────────────────────────────────────
router.post('/', (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body as Record<string, unknown>;
    validateRecurrence(body, true);

    const {
      category_id,
      title,
      description,
      start_date,
      due_date,
      start_time,
      time_to_complete,
      reminder_enabled = false,
      recurrence_type = 'NONE',
      recurrence_interval,
      custom_days,
    } = body;

    const db = getDatabase();

    const category = db
      .prepare('SELECT id FROM categories WHERE id = ? AND deleted_at IS NULL')
      .get(category_id);
    if (!category) {
      throw new AppError(404, 'Not Found', `Category '${category_id}' not found.`);
    }

    const id = crypto.randomUUID();

    db.prepare(`
      INSERT INTO task_templates (
        id, owner_id, category_id, title, description,
        start_date, due_date, start_time, time_to_complete,
        reminder_enabled, recurrence_type, recurrence_interval, custom_days,
        sync_version
      ) VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `).run(
      id,
      category_id,
      (title as string).trim(),
      (description as string | null | undefined) ?? null,
      start_date,
      (due_date as string | null | undefined) ?? null,
      start_time,
      time_to_complete,
      reminder_enabled ? 1 : 0,
      recurrence_type,
      (recurrence_interval as string | null | undefined) ?? null,
      (custom_days as string | null | undefined) ?? null,
    );

    const row = db.prepare('SELECT * FROM task_templates WHERE id = ?').get(id) as Record<string, unknown>;

    // Materialize occurrences so the task shows on calendar immediately.
    const today = todayString();
    const rangeStart = start_date as string;
    let rangeEnd = (due_date as string | null | undefined) ?? rangeStart;
    if (!(due_date as string | null | undefined) && rangeStart <= today) {
      rangeEnd = today;
    }
    if (rangeStart <= rangeEnd) {
      try {
        generateOccurrencesForRange(rangeStart, rangeEnd);
      } catch (genErr) {
        console.error('[Template] Failed to generate occurrences after create:', genErr);
      }
    }

    res.status(201).json(rowToTemplate(row));
  } catch (err) {
    next(err);
  }
});

// ─── PUT /api/v1/task-templates/:id ──────────────────────────────────────────
router.put('/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const db = getDatabase();

    const template = db
      .prepare('SELECT * FROM task_templates WHERE id = ? AND deleted_at IS NULL')
      .get(id) as Record<string, unknown> | undefined;

    if (!template) {
      throw new AppError(404, 'Not Found', `Task template '${id}' not found.`);
    }

    const body = req.body as Record<string, unknown>;
    validateRecurrence(body, false);

    const {
      category_id,
      title,
      description,
      start_date,
      due_date,
      start_time,
      time_to_complete,
      reminder_enabled,
      recurrence_type,
      recurrence_interval,
      custom_days,
    } = body;

    if (category_id !== undefined) {
      const cat = db.prepare('SELECT id FROM categories WHERE id = ? AND deleted_at IS NULL').get(category_id);
      if (!cat) throw new AppError(404, 'Not Found', `Category '${category_id}' not found.`);
    }

    // Dynamic UPDATE
    const sets: string[] = ['updated_at = datetime(\'now\')', 'sync_version = sync_version + 1'];
    const params: unknown[] = [];

    if (category_id !== undefined)    { sets.push('category_id = ?');         params.push(category_id); }
    if (title !== undefined)          { sets.push('title = ?');                params.push((title as string).trim()); }
    if (description !== undefined)    { sets.push('description = ?');          params.push(description); }
    if (start_date !== undefined)     { sets.push('start_date = ?');           params.push(start_date); }
    if (due_date !== undefined)       { sets.push('due_date = ?');             params.push(due_date); }
    if (start_time !== undefined)     { sets.push('start_time = ?');           params.push(start_time); }
    if (time_to_complete !== undefined) { sets.push('time_to_complete = ?');   params.push(time_to_complete); }
    if (reminder_enabled !== undefined) { sets.push('reminder_enabled = ?');   params.push(reminder_enabled ? 1 : 0); }
    if (recurrence_type !== undefined) { sets.push('recurrence_type = ?');     params.push(recurrence_type); }
    if (recurrence_interval !== undefined) { sets.push('recurrence_interval = ?'); params.push(recurrence_interval); }
    if (custom_days !== undefined)    { sets.push('custom_days = ?');          params.push(custom_days); }

    params.push(id);
    db.prepare(`UPDATE task_templates SET ${sets.join(', ')} WHERE id = ?`).run(...params);

    const updated = db.prepare('SELECT * FROM task_templates WHERE id = ?').get(id) as Record<string, unknown>;
    res.json(rowToTemplate(updated));
  } catch (err) {
    next(err);
  }
});

export default router;
