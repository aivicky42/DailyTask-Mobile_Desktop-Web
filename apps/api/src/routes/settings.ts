import { Router, Request, Response, NextFunction } from 'express';
import { getDatabase } from '../db/database';
import { AppError } from '../middleware/errorHandler';
import { Settings, ThemeMode } from '../types';

const router = Router();

const VALID_THEMES: ThemeMode[] = ['light', 'dark', 'system'];

// ─── Helper ───────────────────────────────────────────────────────────────────

function getOrCreateSettings(ownerId: string | null): Settings {
  const db = getDatabase();

  const existing = db
    .prepare('SELECT * FROM settings WHERE owner_id IS ?')
    .get(ownerId) as Settings | undefined;

  if (existing) return existing;

  // Bootstrap default settings for this owner
  const id = crypto.randomUUID();
  db.prepare(`
    INSERT INTO settings (
      id, owner_id, theme, default_reminder, week_start,
      default_duration, notification_sound, language, timezone, sync_version
    ) VALUES (?, ?, 'system', 10, 'Monday', 30, 'default', 'en', 'UTC', 1)
  `).run(id, ownerId);

  return db.prepare('SELECT * FROM settings WHERE id = ?').get(id) as Settings;
}

// ─── GET /api/v1/settings ─────────────────────────────────────────────────────
router.get('/', (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(getOrCreateSettings(null));
  } catch (err) {
    next(err);
  }
});

// ─── PUT /api/v1/settings ─────────────────────────────────────────────────────
router.put('/', (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getDatabase();
    const settings = getOrCreateSettings(null);
    const body = req.body as Record<string, unknown>;

    const {
      theme, default_reminder, week_start,
      default_duration, notification_sound, language, timezone,
    } = body;

    // Validate
    if (theme !== undefined && !VALID_THEMES.includes(theme as ThemeMode)) {
      throw new AppError(
        400, 'Validation Error',
        `theme must be one of: ${VALID_THEMES.join(', ')}.`,
      );
    }
    if (default_reminder !== undefined &&
        (typeof default_reminder !== 'number' || (default_reminder as number) < 0)) {
      throw new AppError(400, 'Validation Error', 'default_reminder must be a non-negative integer (minutes).');
    }
    if (default_duration !== undefined &&
        (typeof default_duration !== 'number' || (default_duration as number) <= 0)) {
      throw new AppError(400, 'Validation Error', 'default_duration must be a positive integer (minutes).');
    }
    if (language !== undefined && typeof language === 'string' && language.length > 10) {
      throw new AppError(400, 'Validation Error', 'language code must be 10 characters or fewer.');
    }
    if (timezone !== undefined && typeof timezone === 'string' && timezone.length > 50) {
      throw new AppError(400, 'Validation Error', 'timezone must be 50 characters or fewer.');
    }

    // Dynamic UPDATE — only touch fields that were provided
    const sets: string[] = ['updated_at = datetime(\'now\')', 'sync_version = sync_version + 1'];
    const params: unknown[] = [];

    if (theme !== undefined)               { sets.push('theme = ?');               params.push(theme); }
    if (default_reminder !== undefined)    { sets.push('default_reminder = ?');    params.push(default_reminder); }
    if (week_start !== undefined)          { sets.push('week_start = ?');          params.push(week_start); }
    if (default_duration !== undefined)    { sets.push('default_duration = ?');    params.push(default_duration); }
    if (notification_sound !== undefined)  { sets.push('notification_sound = ?');  params.push(notification_sound); }
    if (language !== undefined)            { sets.push('language = ?');            params.push(language); }
    if (timezone !== undefined)            { sets.push('timezone = ?');            params.push(timezone); }

    params.push(settings.id);
    db.prepare(`UPDATE settings SET ${sets.join(', ')} WHERE id = ?`).run(...params);

    const updated = db.prepare('SELECT * FROM settings WHERE id = ?').get(settings.id) as Settings;
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

export default router;
