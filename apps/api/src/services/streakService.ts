import { getDatabase, todayString, yesterdayString } from '../db/database';
import { Streak } from '../types';

/**
 * Fetch (or lazily create) the streak record for the given owner.
 * In v1, owner_id is always null (anonymous / single-user).
 */
export function getOrCreateStreak(ownerId: string | null): Streak {
  const db = getDatabase();

  const existing = db
    .prepare('SELECT * FROM streaks WHERE owner_id IS ?')
    .get(ownerId) as Streak | undefined;

  if (existing) return existing;

  const id = crypto.randomUUID();
  db.prepare(`
    INSERT INTO streaks (id, owner_id, current_streak, longest_streak, last_completed_date)
    VALUES (?, ?, 0, 0, NULL)
  `).run(id, ownerId);

  return db.prepare('SELECT * FROM streaks WHERE id = ?').get(id) as Streak;
}

/**
 * Update streak counters after a task has been marked COMPLETED.
 *
 * Rules:
 *  - last_completed_date == today   → already counted, no change
 *  - last_completed_date == yesterday → consecutive day, increment
 *  - anything else                  → streak broken, reset to 1
 *  - longest_streak = max(current, longest)
 */
export function updateStreak(ownerId: string | null): void {
  const db = getDatabase();
  const today = todayString();
  const yesterday = yesterdayString();

  const streak = getOrCreateStreak(ownerId);

  // Already counted today — nothing to do
  if (streak.last_completed_date === today) return;

  const currentStreak =
    streak.last_completed_date === yesterday
      ? streak.current_streak + 1 // Consecutive day
      : 1;                         // Streak broken or first ever

  const longestStreak = Math.max(currentStreak, streak.longest_streak);

  db.prepare(`
    UPDATE streaks
    SET
      current_streak      = ?,
      longest_streak      = ?,
      last_completed_date = ?,
      updated_at          = datetime('now'),
      sync_version        = sync_version + 1
    WHERE id = ?
  `).run(currentStreak, longestStreak, today, streak.id);
}
