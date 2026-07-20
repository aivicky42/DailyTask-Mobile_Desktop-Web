import { Router, Request, Response, NextFunction } from 'express';
import { getDatabase, toBool } from '../db/database';
import { AppError } from '../middleware/errorHandler';
import { SyncRequest, SyncResponse } from '../types';

const router = Router();

// ─── Row transformers ─────────────────────────────────────────────────────────

function transformCategories(rows: Record<string, unknown>[]) {
  return rows.map((r) => ({ ...r, is_system: toBool(r['is_system'] as number) }));
}
function transformTemplates(rows: Record<string, unknown>[]) {
  return rows.map((r) => ({ ...r, reminder_enabled: toBool(r['reminder_enabled'] as number) }));
}
function transformOccurrences(rows: Record<string, unknown>[]) {
  return rows.map((r) => ({
    ...r,
    reminder_enabled: toBool(r['reminder_enabled'] as number),
    is_detached: toBool(r['is_detached'] as number),
  }));
}
function transformSessions(rows: Record<string, unknown>[]) {
  return rows.map((r) => ({ ...r, is_active: toBool(r['is_active'] as number) }));
}

// ─── POST /api/v1/sync ────────────────────────────────────────────────────────
/**
 * Delta sync protocol:
 *
 * Request:
 *   { last_synced_at?: ISO-8601, changes?: { <table>: Record[] } }
 *
 * Response:
 *   { server_changes: { <table>: Record[] }, synced_at: ISO-8601 }
 *
 * Conflict resolution strategy (last-write-wins via sync_version):
 *   - If client record has sync_version > server record → accept client
 *   - Otherwise → server wins (client will receive the authoritative copy)
 *
 * NOTE: Full bidirectional merge is a large surface area.  The implementation
 * here covers the common case for the offline-first local database.  Cloud
 * PostgreSQL sync (v2) will layer CRDTs on top.
 */
router.post('/', (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body as SyncRequest;
    const since = body.last_synced_at ?? '1970-01-01T00:00:00.000Z';
    const clientChanges = body.changes ?? {};

    const db = getDatabase();

    // ── Apply client-side changes ────────────────────────────────────────────
    const applyChanges = db.transaction(() => {
      // Helper: for each client record, accept only if sync_version is strictly newer
      function mergeTable(tableName: string, records: Record<string, unknown>[]): void {
        for (const record of records) {
          const rid = record['id'] as string | undefined;
          if (!rid) continue;

          const existing = db
            .prepare(`SELECT sync_version FROM ${tableName} WHERE id = ?`)
            .get(rid) as { sync_version: number } | undefined;

          if (!existing) {
            // Unknown id from client — ignore; clients should only push back
            // records the server has already acknowledged (or handle via create endpoints)
            continue;
          }

          const clientVersion = (record['sync_version'] as number) ?? 0;
          if (clientVersion > existing.sync_version) {
            // Build a generic UPDATE from the record's own fields
            const updateFields = Object.keys(record).filter(
              (k) => k !== 'id' && k !== 'created_at',
            );
            if (updateFields.length === 0) continue;

            const setClauses = updateFields.map((f) => `${f} = ?`).join(', ');
            const values = updateFields.map((f) => record[f]);
            values.push(rid);

            db.prepare(
              `UPDATE ${tableName} SET ${setClauses} WHERE id = ?`,
            ).run(...values);
          }
        }
      }

      const VALID_TABLES = [
        'categories', 'task_templates', 'task_occurrences',
        'timer_sessions', 'reminders', 'settings', 'streaks',
      ] as const;

      for (const table of VALID_TABLES) {
        const records = clientChanges[table as keyof typeof clientChanges];
        if (Array.isArray(records) && records.length > 0) {
          mergeTable(table, records as Record<string, unknown>[]);
        }
      }
    });

    applyChanges();

    // ── Collect server-side changes since last_synced_at ─────────────────────
    const serverChanges: SyncResponse['server_changes'] = {
      categories: transformCategories(
        db.prepare(`SELECT * FROM categories WHERE updated_at > ?`).all(since) as Record<string, unknown>[],
      ) as SyncResponse['server_changes']['categories'],

      task_templates: transformTemplates(
        db.prepare(`SELECT * FROM task_templates WHERE updated_at > ?`).all(since) as Record<string, unknown>[],
      ) as SyncResponse['server_changes']['task_templates'],

      task_occurrences: transformOccurrences(
        db.prepare(`SELECT * FROM task_occurrences WHERE updated_at > ?`).all(since) as Record<string, unknown>[],
      ) as SyncResponse['server_changes']['task_occurrences'],

      timer_sessions: transformSessions(
        db.prepare(`SELECT * FROM timer_sessions WHERE updated_at > ?`).all(since) as Record<string, unknown>[],
      ) as SyncResponse['server_changes']['timer_sessions'],

      reminders: db
        .prepare(`SELECT * FROM reminders WHERE updated_at > ?`)
        .all(since) as SyncResponse['server_changes']['reminders'],

      settings: db
        .prepare(`SELECT * FROM settings WHERE updated_at > ?`)
        .all(since) as SyncResponse['server_changes']['settings'],

      streaks: db
        .prepare(`SELECT * FROM streaks WHERE updated_at > ?`)
        .all(since) as SyncResponse['server_changes']['streaks'],
    };

    const response: SyncResponse = {
      server_changes: serverChanges,
      synced_at: new Date().toISOString(),
    };

    res.json(response);
  } catch (err) {
    if (err instanceof AppError) { next(err); return; }
    next(err);
  }
});

export default router;
