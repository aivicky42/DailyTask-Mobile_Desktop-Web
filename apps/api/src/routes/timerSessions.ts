import { Router, Request, Response, NextFunction } from 'express';
import { getDatabase, toBool } from '../db/database';
import { AppError } from '../middleware/errorHandler';
import { TimerSession, TaskOccurrence } from '../types';
import Database from 'better-sqlite3';

const router = Router();

// ─── Row helpers ──────────────────────────────────────────────────────────────

function rowToSession(row: Record<string, unknown>): TimerSession {
  return {
    ...(row as Omit<TimerSession, 'is_active'>),
    is_active: toBool(row['is_active'] as number),
  };
}

function rowToOccurrence(row: Record<string, unknown>): TaskOccurrence {
  return {
    ...(row as Omit<TaskOccurrence, 'reminder_enabled' | 'is_detached'>),
    reminder_enabled: toBool(row['reminder_enabled'] as number),
    is_detached: toBool(row['is_detached'] as number),
  };
}

// ─── Internal helper ──────────────────────────────────────────────────────────

/**
 * Pause any currently active timer session.
 * Accumulates elapsed seconds into the associated task occurrence.
 * Returns the id of the paused occurrence (or null if nothing was active).
 */
function pauseActiveSession(db: Database.Database): string | null {
  const activeSession = db
    .prepare(`
      SELECT * FROM timer_sessions
      WHERE is_active = 1 AND deleted_at IS NULL
    `)
    .get() as Record<string, unknown> | undefined;

  if (!activeSession) return null;

  const now = new Date();
  const sessionStart = new Date(activeSession['start_time'] as string);
  const elapsedSeconds = Math.max(
    0,
    Math.floor((now.getTime() - sessionStart.getTime()) / 1000),
  );

  db.prepare(`
    UPDATE timer_sessions
    SET is_active = 0,
        end_time  = ?,
        updated_at = datetime('now'),
        sync_version = sync_version + 1
    WHERE id = ?
  `).run(now.toISOString(), activeSession['id']);

  db.prepare(`
    UPDATE task_occurrences
    SET elapsed_time = elapsed_time + ?,
        updated_at   = datetime('now'),
        sync_version = sync_version + 1
    WHERE id = ?
  `).run(elapsedSeconds, activeSession['task_occurrence_id']);

  return activeSession['task_occurrence_id'] as string;
}

// ─── POST /api/v1/timer-sessions/play ────────────────────────────────────────
router.post('/play', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { task_occurrence_id } = req.body as Record<string, unknown>;

    if (!task_occurrence_id || typeof task_occurrence_id !== 'string') {
      throw new AppError(400, 'Validation Error', 'task_occurrence_id is required.');
    }

    const db = getDatabase();

    const occurrence = db
      .prepare('SELECT * FROM task_occurrences WHERE id = ? AND deleted_at IS NULL')
      .get(task_occurrence_id) as Record<string, unknown> | undefined;

    if (!occurrence) {
      throw new AppError(404, 'Not Found', `Task occurrence '${task_occurrence_id}' not found.`);
    }
    if (occurrence['status'] === 'COMPLETED') {
      throw new AppError(400, 'Bad Request', 'Cannot start a timer for a completed task.');
    }

    let sessionId!: string;

    const play = db.transaction(() => {
      // Auto-pause any existing active session first
      pauseActiveSession(db);

      // Create new active session
      sessionId = crypto.randomUUID();
      const now = new Date().toISOString();

      db.prepare(`
        INSERT INTO timer_sessions (
          id, owner_id, task_occurrence_id, start_time, end_time, is_active, sync_version
        ) VALUES (?, NULL, ?, ?, NULL, 1, 1)
      `).run(sessionId, task_occurrence_id, now);

      // Move task to IN_PROGRESS
      db.prepare(`
        UPDATE task_occurrences
        SET status       = 'IN_PROGRESS',
            updated_at   = datetime('now'),
            sync_version = sync_version + 1
        WHERE id = ?
      `).run(task_occurrence_id);
    });

    play();

    const session = db
      .prepare('SELECT * FROM timer_sessions WHERE id = ?')
      .get(sessionId) as Record<string, unknown>;

    const updatedOccurrence = db
      .prepare('SELECT * FROM task_occurrences WHERE id = ?')
      .get(task_occurrence_id) as Record<string, unknown>;

    res.status(201).json({
      session: rowToSession(session),
      task_occurrence: rowToOccurrence(updatedOccurrence),
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/v1/timer-sessions/pause ───────────────────────────────────────
router.post('/pause', (_req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getDatabase();

    const activeSession = db
      .prepare(`
        SELECT * FROM timer_sessions
        WHERE is_active = 1 AND deleted_at IS NULL
      `)
      .get() as Record<string, unknown> | undefined;

    if (!activeSession) {
      throw new AppError(404, 'Not Found', 'No active timer session to pause.');
    }

    const now = new Date();
    const sessionStart = new Date(activeSession['start_time'] as string);
    const elapsedSeconds = Math.max(
      0,
      Math.floor((now.getTime() - sessionStart.getTime()) / 1000),
    );
    const sessionId = activeSession['id'] as string;
    const occurrenceId = activeSession['task_occurrence_id'] as string;

    const doPause = db.transaction(() => {
      db.prepare(`
        UPDATE timer_sessions
        SET is_active    = 0,
            end_time     = ?,
            updated_at   = datetime('now'),
            sync_version = sync_version + 1
        WHERE id = ?
      `).run(now.toISOString(), sessionId);

      db.prepare(`
        UPDATE task_occurrences
        SET elapsed_time = elapsed_time + ?,
            updated_at   = datetime('now'),
            sync_version = sync_version + 1
        WHERE id = ?
      `).run(elapsedSeconds, occurrenceId);
    });

    doPause();

    const updatedSession = db
      .prepare('SELECT * FROM timer_sessions WHERE id = ?')
      .get(sessionId) as Record<string, unknown>;

    const updatedOccurrence = db
      .prepare('SELECT * FROM task_occurrences WHERE id = ?')
      .get(occurrenceId) as Record<string, unknown>;

    res.json({
      session: rowToSession(updatedSession),
      task_occurrence: rowToOccurrence(updatedOccurrence),
      elapsed_this_session_seconds: elapsedSeconds,
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/v1/timer-sessions/active ───────────────────────────────────────
router.get('/active', (_req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getDatabase();

    const activeSession = db
      .prepare(`
        SELECT * FROM timer_sessions
        WHERE is_active = 1 AND deleted_at IS NULL
      `)
      .get() as Record<string, unknown> | undefined;

    if (!activeSession) {
      // 204 No Content — caller can detect "no active timer" by status code
      res.status(204).send();
      return;
    }

    const occurrence = db
      .prepare('SELECT * FROM task_occurrences WHERE id = ?')
      .get(activeSession['task_occurrence_id']) as Record<string, unknown> | null;

    const now = new Date();
    const sessionStart = new Date(activeSession['start_time'] as string);
    const currentSessionSeconds = Math.max(
      0,
      Math.floor((now.getTime() - sessionStart.getTime()) / 1000),
    );
    const storedElapsed = occurrence ? (occurrence['elapsed_time'] as number) : 0;
    const totalElapsedSeconds = storedElapsed + currentSessionSeconds;

    res.json({
      session: rowToSession(activeSession),
      current_session_elapsed_seconds: currentSessionSeconds,
      total_elapsed_seconds: totalElapsedSeconds,
      task_occurrence: occurrence ? rowToOccurrence(occurrence) : null,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
