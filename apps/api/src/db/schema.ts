import Database from 'better-sqlite3';

/**
 * Creates all tables, indexes, and seeds system data.
 * Uses CREATE TABLE IF NOT EXISTS / INSERT OR IGNORE so it's safe to call on every startup.
 */
export function initializeSchema(db: Database.Database): void {
  // Run schema in a single transaction for atomicity
  db.exec(`
    -- ─── Categories ────────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS categories (
      id                TEXT    PRIMARY KEY,
      owner_id          TEXT,
      name              TEXT    NOT NULL,
      icon_path         TEXT,
      is_system         INTEGER NOT NULL DEFAULT 0,
      color_hex         TEXT    NOT NULL DEFAULT '#808080',
      created_at        TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at        TEXT    NOT NULL DEFAULT (datetime('now')),
      deleted_at        TEXT,
      sync_version      INTEGER NOT NULL DEFAULT 1
    );

    -- ─── Task Templates ────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS task_templates (
      id                  TEXT    PRIMARY KEY,
      owner_id            TEXT,
      category_id         TEXT    NOT NULL,
      title               TEXT    NOT NULL,
      description         TEXT,
      start_date          TEXT    NOT NULL,
      due_date            TEXT,
      start_time          TEXT    NOT NULL,
      time_to_complete    INTEGER NOT NULL,
      reminder_enabled    INTEGER NOT NULL DEFAULT 0,
      recurrence_type     TEXT    NOT NULL DEFAULT 'NONE',
      recurrence_interval TEXT,
      custom_days         TEXT,
      created_at          TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at          TEXT    NOT NULL DEFAULT (datetime('now')),
      deleted_at          TEXT,
      sync_version        INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (category_id) REFERENCES categories(id)
    );

    -- ─── Task Occurrences ──────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS task_occurrences (
      id                TEXT    PRIMARY KEY,
      owner_id          TEXT,
      task_template_id  TEXT,
      date              TEXT    NOT NULL,
      title             TEXT    NOT NULL,
      description       TEXT,
      category_id       TEXT    NOT NULL,
      start_time        TEXT    NOT NULL,
      time_to_complete  INTEGER NOT NULL,
      status            TEXT    NOT NULL DEFAULT 'TODO',
      elapsed_time      INTEGER NOT NULL DEFAULT 0,
      reminder_enabled  INTEGER NOT NULL DEFAULT 0,
      is_detached       INTEGER NOT NULL DEFAULT 0,
      created_at        TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at        TEXT    NOT NULL DEFAULT (datetime('now')),
      deleted_at        TEXT,
      sync_version      INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (task_template_id) REFERENCES task_templates(id) ON DELETE SET NULL,
      FOREIGN KEY (category_id) REFERENCES categories(id)
    );

    -- ─── Timer Sessions ────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS timer_sessions (
      id                  TEXT    PRIMARY KEY,
      owner_id            TEXT,
      task_occurrence_id  TEXT    NOT NULL,
      start_time          TEXT    NOT NULL,
      end_time            TEXT,
      is_active           INTEGER NOT NULL DEFAULT 1,
      created_at          TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at          TEXT    NOT NULL DEFAULT (datetime('now')),
      deleted_at          TEXT,
      sync_version        INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (task_occurrence_id) REFERENCES task_occurrences(id) ON DELETE CASCADE
    );

    -- ─── Reminders ────────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS reminders (
      id                  TEXT    PRIMARY KEY,
      owner_id            TEXT,
      task_occurrence_id  TEXT    NOT NULL,
      scheduled_time      TEXT    NOT NULL,
      status              TEXT    NOT NULL DEFAULT 'PENDING',
      snooze_count        INTEGER NOT NULL DEFAULT 0,
      created_at          TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at          TEXT    NOT NULL DEFAULT (datetime('now')),
      deleted_at          TEXT,
      sync_version        INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (task_occurrence_id) REFERENCES task_occurrences(id) ON DELETE CASCADE
    );

    -- ─── Settings ─────────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS settings (
      id                  TEXT    PRIMARY KEY,
      owner_id            TEXT    UNIQUE,
      theme               TEXT    NOT NULL DEFAULT 'system',
      default_reminder    INTEGER NOT NULL DEFAULT 10,
      week_start          TEXT    NOT NULL DEFAULT 'Monday',
      default_duration    INTEGER NOT NULL DEFAULT 30,
      notification_sound  TEXT    NOT NULL DEFAULT 'default',
      language            TEXT    NOT NULL DEFAULT 'en',
      timezone            TEXT    NOT NULL DEFAULT 'UTC',
      created_at          TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at          TEXT    NOT NULL DEFAULT (datetime('now')),
      deleted_at          TEXT,
      sync_version        INTEGER NOT NULL DEFAULT 1
    );

    -- ─── Streaks ──────────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS streaks (
      id                    TEXT    PRIMARY KEY,
      owner_id              TEXT    UNIQUE,
      current_streak        INTEGER NOT NULL DEFAULT 0,
      longest_streak        INTEGER NOT NULL DEFAULT 0,
      last_completed_date   TEXT,
      created_at            TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at            TEXT    NOT NULL DEFAULT (datetime('now')),
      deleted_at            TEXT,
      sync_version          INTEGER NOT NULL DEFAULT 1
    );

    -- ─── Indexes ──────────────────────────────────────────────────────────────

    -- Enforce single active timer (partial unique index)
    CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_timer
      ON timer_sessions(is_active)
      WHERE is_active = 1 AND deleted_at IS NULL;

    -- Performance indexes
    CREATE INDEX IF NOT EXISTS idx_task_occurrences_date
      ON task_occurrences(date)
      WHERE deleted_at IS NULL;

    CREATE INDEX IF NOT EXISTS idx_task_occurrences_template
      ON task_occurrences(task_template_id)
      WHERE deleted_at IS NULL;

    CREATE INDEX IF NOT EXISTS idx_task_occurrences_status
      ON task_occurrences(status)
      WHERE deleted_at IS NULL;

    CREATE INDEX IF NOT EXISTS idx_task_occurrences_category
      ON task_occurrences(category_id)
      WHERE deleted_at IS NULL;

    CREATE INDEX IF NOT EXISTS idx_task_templates_recurrence
      ON task_templates(recurrence_type)
      WHERE deleted_at IS NULL;

    CREATE INDEX IF NOT EXISTS idx_categories_system
      ON categories(is_system)
      WHERE deleted_at IS NULL;
  `);

  seedSystemCategories(db);
}

function seedSystemCategories(db: Database.Database): void {
  const systemCategories = [
    { id: '00000000-0000-0000-0000-000000000001', name: 'Work',     color_hex: '#2196F3' },
    { id: '00000000-0000-0000-0000-000000000002', name: 'Personal', color_hex: '#9C27B0' },
    { id: '00000000-0000-0000-0000-000000000003', name: 'Study',    color_hex: '#FF9800' },
    { id: '00000000-0000-0000-0000-000000000004', name: 'Health',   color_hex: '#4CAF50' },
    { id: '00000000-0000-0000-0000-000000000005', name: 'Life',     color_hex: '#F44336' },
    { id: '00000000-0000-0000-0000-000000000006', name: 'Others',   color_hex: '#9E9E9E' },
  ] as const;

  const insert = db.prepare(`
    INSERT OR IGNORE INTO categories (id, owner_id, name, icon_path, is_system, color_hex, sync_version)
    VALUES (?, NULL, ?, NULL, 1, ?, 1)
  `);

  const seedAll = db.transaction(() => {
    for (const cat of systemCategories) {
      insert.run(cat.id, cat.name, cat.color_hex);
    }
  });

  seedAll();
}
