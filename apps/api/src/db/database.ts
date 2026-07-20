import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { initializeSchema } from './schema';

let dbInstance: Database.Database | null = null;

/**
 * Returns the singleton better-sqlite3 database connection.
 * Initializes schema + seeds on first call.
 */
export function getDatabase(): Database.Database {
  if (dbInstance) return dbInstance;

  const dbPath = process.env.DB_PATH ?? path.join(process.cwd(), 'data', 'dailytask.db');
  const dbDir = path.dirname(dbPath);

  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  dbInstance = new Database(dbPath);

  // WAL mode for concurrent reads + writes; normal sync for a good speed/safety balance
  dbInstance.pragma('journal_mode = WAL');
  dbInstance.pragma('foreign_keys = ON');
  dbInstance.pragma('synchronous = NORMAL');
  dbInstance.pragma('cache_size = -32000'); // 32 MB page cache
  dbInstance.pragma('temp_store = MEMORY');

  initializeSchema(dbInstance);

  return dbInstance;
}

/** Used by the health endpoint to verify the connection is alive. */
export function checkDatabaseHealth(): boolean {
  try {
    const db = getDatabase();
    db.prepare('SELECT 1').get();
    return true;
  } catch {
    return false;
  }
}

/** Close the connection (useful for graceful shutdown / tests). */
export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

// ─── Row transform helpers ────────────────────────────────────────────────────

/** SQLite stores booleans as 0/1 integers. Convert to JS boolean. */
export function toBool(value: number | boolean | null | undefined): boolean {
  return value === 1 || value === true;
}

/** Convert JS boolean to SQLite integer (0/1). */
export function fromBool(value: boolean | undefined): number {
  return value ? 1 : 0;
}

/** Today's date as 'YYYY-MM-DD' in local time. */
export function todayString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Yesterday's date as 'YYYY-MM-DD'. */
export function yesterdayString(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
