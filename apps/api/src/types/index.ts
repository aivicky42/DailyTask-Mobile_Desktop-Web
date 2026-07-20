// ─── Enum Types ────────────────────────────────────────────────────────────────

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'COMPLETED';
export type ReminderStatus = 'PENDING' | 'SNOOZED' | 'DISMISSED' | 'TRIGGERED';
export type RecurrenceType = 'NONE' | 'DAILY' | 'RECURRING' | 'CUSTOM';
export type RecurrenceInterval = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
export type ThemeMode = 'light' | 'dark' | 'system';
export type DeleteScope = 'SINGLE' | 'RANGE' | 'ALL_RECURRING';

// ─── Domain Models ─────────────────────────────────────────────────────────────

export interface Category {
  id: string;
  owner_id: string | null;
  name: string;
  icon_path: string | null;
  is_system: boolean;
  color_hex: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sync_version: number;
}

export interface TaskTemplate {
  id: string;
  owner_id: string | null;
  category_id: string;
  title: string;
  description: string | null;
  start_date: string;
  due_date: string | null;
  start_time: string;
  time_to_complete: number;
  reminder_enabled: boolean;
  recurrence_type: RecurrenceType;
  recurrence_interval: RecurrenceInterval | null;
  custom_days: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sync_version: number;
}

export interface TaskOccurrence {
  id: string;
  owner_id: string | null;
  task_template_id: string | null;
  date: string;
  title: string;
  description: string | null;
  category_id: string;
  start_time: string;
  time_to_complete: number;
  status: TaskStatus;
  elapsed_time: number;
  reminder_enabled: boolean;
  is_detached: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sync_version: number;
}

export interface TimerSession {
  id: string;
  owner_id: string | null;
  task_occurrence_id: string;
  start_time: string;
  end_time: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sync_version: number;
}

export interface Reminder {
  id: string;
  owner_id: string | null;
  task_occurrence_id: string;
  scheduled_time: string;
  status: ReminderStatus;
  snooze_count: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sync_version: number;
}

export interface Settings {
  id: string;
  owner_id: string | null;
  theme: ThemeMode;
  default_reminder: number;
  week_start: string;
  default_duration: number;
  notification_sound: string;
  language: string;
  timezone: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sync_version: number;
}

export interface Streak {
  id: string;
  owner_id: string | null;
  current_streak: number;
  longest_streak: number;
  last_completed_date: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sync_version: number;
}

// ─── API Contracts ─────────────────────────────────────────────────────────────

/** RFC 7807 Problem Details */
export interface ApiError {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface ConflictCheckInput {
  date: string;
  start_time: string;
  time_to_complete: number;
  exclude_id?: string;
}

export interface ConflictTask {
  id: string;
  title: string;
  start_time: string;
  end_time: string;  // computed: start_time + time_to_complete
}

export interface ConflictCheckResult {
  has_conflict: boolean;
  conflicting_tasks: ConflictTask[];
}

export interface HealthResponse {
  status: 'ok' | 'degraded';
  database: 'connected' | 'error';
  version: string;
  timestamp: string;
}

export interface AnalyticsTimeSpent {
  date: string;
  total_seconds_spent: number;
}

export interface AnalyticsCompletionRate {
  date: string;
  completed_count: number;
  total_count: number;
  completion_rate: number;
}

export interface SyncRequest {
  last_synced_at?: string;
  changes?: {
    categories?: Partial<Category>[];
    task_templates?: Partial<TaskTemplate>[];
    task_occurrences?: Partial<TaskOccurrence>[];
    timer_sessions?: Partial<TimerSession>[];
    reminders?: Partial<Reminder>[];
    settings?: Partial<Settings>[];
    streaks?: Partial<Streak>[];
  };
}

export interface SyncResponse {
  server_changes: {
    categories: Category[];
    task_templates: TaskTemplate[];
    task_occurrences: TaskOccurrence[];
    timer_sessions: TimerSession[];
    reminders: Reminder[];
    settings: Settings[];
    streaks: Streak[];
  };
  synced_at: string;
}

// ─── Internal / DB Row types ───────────────────────────────────────────────────

/** Raw row as returned by better-sqlite3 (booleans as 0/1 integers) */
export interface DbRow {
  [key: string]: unknown;
}
