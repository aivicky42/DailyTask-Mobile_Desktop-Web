import { Router, Request, Response, NextFunction } from 'express';
import { getDatabase, toBool } from '../db/database';
import { AppError } from '../middleware/errorHandler';
import { TaskOccurrence, TaskStatus, DeleteScope } from '../types';
import { checkConflict } from '../services/conflictService';
import { updateStreak } from '../services/streakService';

const router = Router();

const VALID_STATUSES: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'COMPLETED'];
const VALID_SCOPES: DeleteScope[] = ['SINGLE', 'RANGE', 'ALL_RECURRING'];

// ─── Row helpers ──────────────────────────────────────────────────────────────

function rowToOccurrence(row: Record<string, unknown>): TaskOccurrence {
  return {
    ...(row as Omit<TaskOccurrence, 'reminder_enabled' | 'is_detached'>),
    reminder_enabled: toBool(row['reminder_enabled'] as number),
    is_detached: toBool(row['is_detached'] as number),
  };
}

// ─── WHERE clause builder for list endpoint ──────────────────────────────────

interface WhereResult {
  clause: string;
  params: unknown[];
}

function buildWhere(query: Record<string, unknown>): WhereResult {
  const conditions: string[] = ['deleted_at IS NULL'];
  const params: unknown[] = [];

  if (query['date']) {
    conditions.push('date = ?');
    params.push(query['date']);
  } else {
    if (query['start_date']) { conditions.push('date >= ?'); params.push(query['start_date']); }
    if (query['end_date'])   { conditions.push('date <= ?'); params.push(query['end_date']); }
  }

  if (query['category_id']) {
    conditions.push('category_id = ?');
    params.push(query['category_id']);
  }

  if (query['status']) {
    if (!VALID_STATUSES.includes(query['status'] as TaskStatus)) {
      throw new AppError(
        400,
        'Validation Error',
        `status must be one of: ${VALID_STATUSES.join(', ')}.`,
      );
    }
    conditions.push('status = ?');
    params.push(query['status']);
  }

  if (query['search']) {
    conditions.push('(title LIKE ? OR description LIKE ?)');
    const term = `%${query['search']}%`;
    params.push(term, term);
  }

  return { clause: conditions.join(' AND '), params };
}

// ─── GET /api/v1/task-occurrences ────────────────────────────────────────────
router.get('/', (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getDatabase();
    const page = Math.max(1, parseInt(req.query['page'] as string) || 1);
    const page_size = Math.min(100, Math.max(1, parseInt(req.query['page_size'] as string) || 20));
    const offset = (page - 1) * page_size;

    const { clause, params } = buildWhere(req.query as Record<string, unknown>);

    const total = (
      db.prepare(`SELECT COUNT(*) AS count FROM task_occurrences WHERE ${clause}`).get(...params) as { count: number }
    ).count;

    const rows = db
      .prepare(`
        SELECT * FROM task_occurrences
        WHERE ${clause}
        ORDER BY date ASC, start_time ASC
        LIMIT ? OFFSET ?
      `)
      .all(...params, page_size, offset) as Record<string, unknown>[];

    res.json({
      data: rows.map(rowToOccurrence),
      total,
      page,
      page_size,
      total_pages: Math.ceil(total / page_size),
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/v1/task-occurrences/check-conflict ────────────────────────────
// Must be registered BEFORE /:id
router.post('/check-conflict', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { date, start_time, time_to_complete, exclude_id } = req.body as Record<string, unknown>;

    if (!date)       throw new AppError(400, 'Validation Error', 'date is required (YYYY-MM-DD).');
    if (!start_time) throw new AppError(400, 'Validation Error', 'start_time is required (HH:MM).');
    if (!time_to_complete || typeof time_to_complete !== 'number' || (time_to_complete as number) <= 0) {
      throw new AppError(400, 'Validation Error', 'time_to_complete must be a positive integer (minutes).');
    }

    const result = checkConflict({
      date: date as string,
      start_time: start_time as string,
      time_to_complete: time_to_complete as number,
      exclude_id: exclude_id as string | undefined,
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/v1/task-occurrences ───────────────────────────────────────────
router.post('/', (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body as Record<string, unknown>;
    const {
      date, title, description, category_id, start_time,
      time_to_complete, reminder_enabled = false, task_template_id,
    } = body;

    if (!date)       throw new AppError(400, 'Validation Error', 'date is required (YYYY-MM-DD).');
    if (!title || typeof title !== 'string' || (title as string).trim().length === 0) {
      throw new AppError(400, 'Validation Error', 'title is required and must be non-empty.');
    }
    if (!category_id) throw new AppError(400, 'Validation Error', 'category_id is required.');
    if (!start_time)  throw new AppError(400, 'Validation Error', 'start_time is required (HH:MM).');
    if (!time_to_complete || typeof time_to_complete !== 'number' || (time_to_complete as number) <= 0) {
      throw new AppError(400, 'Validation Error', 'time_to_complete must be a positive integer (minutes).');
    }
    if ((title as string).length > 100) {
      throw new AppError(400, 'Validation Error', 'title must be 100 characters or fewer.');
    }

    const db = getDatabase();

    const category = db
      .prepare('SELECT id FROM categories WHERE id = ? AND deleted_at IS NULL')
      .get(category_id);
    if (!category) throw new AppError(404, 'Not Found', `Category '${category_id}' not found.`);

    // Conflict check
    const conflictResult = checkConflict({
      date: date as string,
      start_time: start_time as string,
      time_to_complete: time_to_complete as number,
    });
    if (conflictResult.has_conflict) {
      throw new AppError(
        409,
        'Schedule Conflict',
        'The proposed time block overlaps with an existing task.',
        'https://dailytask.app/errors/schedule-conflict',
      );
    }

    const id = crypto.randomUUID();

    db.prepare(`
      INSERT INTO task_occurrences (
        id, owner_id, task_template_id, date, title, description,
        category_id, start_time, time_to_complete, status,
        elapsed_time, reminder_enabled, is_detached, sync_version
      ) VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, 'TODO', 0, ?, 0, 1)
    `).run(
      id,
      (task_template_id as string | null | undefined) ?? null,
      date,
      (title as string).trim(),
      (description as string | null | undefined) ?? null,
      category_id,
      start_time,
      time_to_complete,
      reminder_enabled ? 1 : 0,
    );

    const row = db.prepare('SELECT * FROM task_occurrences WHERE id = ?').get(id) as Record<string, unknown>;
    res.status(201).json(rowToOccurrence(row));
  } catch (err) {
    next(err);
  }
});

// ─── PUT /api/v1/task-occurrences/:id ────────────────────────────────────────
router.put('/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    // decouple=true means: detach this occurrence from its template (current-day-only edit)
    const decouple = req.query['decouple'] === 'true';
    const db = getDatabase();

    const occurrence = db
      .prepare('SELECT * FROM task_occurrences WHERE id = ? AND deleted_at IS NULL')
      .get(id) as Record<string, unknown> | undefined;

    if (!occurrence) {
      throw new AppError(404, 'Not Found', `Task occurrence '${id}' not found.`);
    }

    const body = req.body as Record<string, unknown>;
    const { title, description, date, category_id, start_time, time_to_complete, status, reminder_enabled } = body;

    if (status !== undefined && !VALID_STATUSES.includes(status as TaskStatus)) {
      throw new AppError(400, 'Validation Error', `status must be one of: ${VALID_STATUSES.join(', ')}.`);
    }
    if (title !== undefined && (title as string).length > 100) {
      throw new AppError(400, 'Validation Error', 'title must be 100 characters or fewer.');
    }
    if (time_to_complete !== undefined && (typeof time_to_complete !== 'number' || (time_to_complete as number) <= 0)) {
      throw new AppError(400, 'Validation Error', 'time_to_complete must be a positive integer (minutes).');
    }

    // Conflict check if scheduling fields change
    if (start_time !== undefined || time_to_complete !== undefined || date !== undefined) {
      const conflictResult = checkConflict({
        date: (date as string | undefined) ?? (occurrence['date'] as string),
        start_time: (start_time as string | undefined) ?? (occurrence['start_time'] as string),
        time_to_complete: (time_to_complete as number | undefined) ?? (occurrence['time_to_complete'] as number),
        exclude_id: id,
      });
      if (conflictResult.has_conflict) {
        throw new AppError(
          409,
          'Schedule Conflict',
          'The updated time block overlaps with an existing task.',
          'https://dailytask.app/errors/schedule-conflict',
        );
      }
    }

    if (category_id !== undefined) {
      const cat = db.prepare('SELECT id FROM categories WHERE id = ? AND deleted_at IS NULL').get(category_id);
      if (!cat) throw new AppError(404, 'Not Found', `Category '${category_id}' not found.`);
    }

    const wasCompleted = occurrence['status'] === 'COMPLETED';

    // Dynamic UPDATE
    const sets: string[] = ['updated_at = datetime(\'now\')', 'sync_version = sync_version + 1'];
    const params: unknown[] = [];

    if (title !== undefined)           { sets.push('title = ?');           params.push((title as string).trim()); }
    if (description !== undefined)     { sets.push('description = ?');     params.push(description); }
    if (date !== undefined)            { sets.push('date = ?');             params.push(date); }
    if (category_id !== undefined)     { sets.push('category_id = ?');     params.push(category_id); }
    if (start_time !== undefined)      { sets.push('start_time = ?');      params.push(start_time); }
    if (time_to_complete !== undefined){ sets.push('time_to_complete = ?');params.push(time_to_complete); }
    if (status !== undefined)          { sets.push('status = ?');          params.push(status); }
    if (reminder_enabled !== undefined){ sets.push('reminder_enabled = ?');params.push(reminder_enabled ? 1 : 0); }
    if (decouple)                      { sets.push('is_detached = 1'); }

    params.push(id);
    db.prepare(`UPDATE task_occurrences SET ${sets.join(', ')} WHERE id = ?`).run(...params);

    // Update streak when a task is newly marked COMPLETED
    if (!wasCompleted && status === 'COMPLETED') {
      updateStreak(null);
    }

    const updated = db.prepare('SELECT * FROM task_occurrences WHERE id = ?').get(id) as Record<string, unknown>;
    res.json(rowToOccurrence(updated));
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/v1/task-occurrences/:id ─────────────────────────────────────
router.delete('/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const scope = ((req.query['scope'] as string) || 'SINGLE').toUpperCase() as DeleteScope;
    const { start_date, end_date } = req.query as Record<string, string>;

    if (!VALID_SCOPES.includes(scope)) {
      throw new AppError(400, 'Validation Error', `scope must be one of: ${VALID_SCOPES.join(', ')}.`);
    }

    const db = getDatabase();

    const occurrence = db
      .prepare('SELECT * FROM task_occurrences WHERE id = ? AND deleted_at IS NULL')
      .get(id) as Record<string, unknown> | undefined;

    if (!occurrence) {
      throw new AppError(404, 'Not Found', `Task occurrence '${id}' not found.`);
    }

    const templateId = occurrence['task_template_id'] as string | null;

    const doDelete = db.transaction(() => {
      const SOFT = `
        UPDATE task_occurrences
        SET deleted_at = datetime('now'), updated_at = datetime('now'), sync_version = sync_version + 1
        WHERE
      `;

      if (scope === 'SINGLE') {
        db.prepare(`${SOFT} id = ?`).run(id);
        return;
      }

      if (scope === 'RANGE') {
        if (!templateId) {
          // No template — fall back to SINGLE
          db.prepare(`${SOFT} id = ?`).run(id);
          return;
        }
        const conditions: string[] = ['task_template_id = ?', 'deleted_at IS NULL'];
        const params: unknown[] = [templateId];
        if (start_date) { conditions.push('date >= ?'); params.push(start_date); }
        if (end_date)   { conditions.push('date <= ?'); params.push(end_date); }
        db.prepare(
          `UPDATE task_occurrences
           SET deleted_at = datetime('now'), updated_at = datetime('now'), sync_version = sync_version + 1
           WHERE ${conditions.join(' AND ')}`
        ).run(...params);
        return;
      }

      if (scope === 'ALL_RECURRING') {
        if (templateId) {
          // Soft-delete every occurrence linked to this template
          db.prepare(`
            UPDATE task_occurrences
            SET deleted_at = datetime('now'), updated_at = datetime('now'), sync_version = sync_version + 1
            WHERE task_template_id = ? AND deleted_at IS NULL
          `).run(templateId);

          // Soft-delete the template itself
          db.prepare(`
            UPDATE task_templates
            SET deleted_at = datetime('now'), updated_at = datetime('now'), sync_version = sync_version + 1
            WHERE id = ? AND deleted_at IS NULL
          `).run(templateId);
        } else {
          // Standalone occurrence — just delete it
          db.prepare(`${SOFT} id = ?`).run(id);
        }
      }
    });

    doDelete();
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
