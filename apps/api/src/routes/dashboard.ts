import { Router, Request, Response, NextFunction } from 'express';
import { getDatabase } from '../db/database';
import { getOrCreateStreak } from '../services/streakService';
import { AnalyticsTimeSpent, AnalyticsCompletionRate } from '../types';

const router = Router();

// ─── GET /api/v1/dashboard/streaks ───────────────────────────────────────────
router.get('/streaks', (_req: Request, res: Response, next: NextFunction) => {
  try {
    const streak = getOrCreateStreak(null);
    res.json({
      current_streak: streak.current_streak,
      longest_streak: streak.longest_streak,
      last_completed_date: streak.last_completed_date,
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/v1/dashboard/analytics/time-spent ──────────────────────────────
router.get('/analytics/time-spent', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { start_date, end_date } = req.query as Record<string, string>;

    const db = getDatabase();
    const conditions: string[] = ['deleted_at IS NULL'];
    const params: unknown[] = [];

    if (start_date) { conditions.push('date >= ?'); params.push(start_date); }
    if (end_date)   { conditions.push('date <= ?'); params.push(end_date); }

    const rows = db
      .prepare(`
        SELECT date, SUM(elapsed_time) AS total_seconds_spent
        FROM task_occurrences
        WHERE ${conditions.join(' AND ')}
        GROUP BY date
        ORDER BY date ASC
      `)
      .all(...params) as AnalyticsTimeSpent[];

    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/v1/dashboard/analytics/completion-rate ─────────────────────────
router.get('/analytics/completion-rate', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { start_date, end_date } = req.query as Record<string, string>;

    const db = getDatabase();
    const conditions: string[] = ['deleted_at IS NULL'];
    const params: unknown[] = [];

    if (start_date) { conditions.push('date >= ?'); params.push(start_date); }
    if (end_date)   { conditions.push('date <= ?'); params.push(end_date); }

    const rows = db
      .prepare(`
        SELECT
          date,
          COUNT(*) AS total_count,
          SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) AS completed_count
        FROM task_occurrences
        WHERE ${conditions.join(' AND ')}
        GROUP BY date
        ORDER BY date ASC
      `)
      .all(...params) as Array<{ date: string; total_count: number; completed_count: number }>;

    const result: AnalyticsCompletionRate[] = rows.map((r) => ({
      date: r.date,
      completed_count: r.completed_count,
      total_count: r.total_count,
      completion_rate:
        r.total_count > 0
          ? Math.round((r.completed_count / r.total_count) * 10000) / 10000 // 4 decimal places
          : 0,
    }));

    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
