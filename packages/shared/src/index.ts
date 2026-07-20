// ─── Enums ──────────────────────────────────────────────────────────────────

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'COMPLETED';
export type ReminderStatus = 'PENDING' | 'SNOOZED' | 'DISMISSED' | 'TRIGGERED';
export type RecurrenceType = 'NONE' | 'DAILY' | 'RECURRING' | 'CUSTOM';
export type RecurrenceInterval = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
export type ThemeMode = 'light' | 'dark' | 'system';
export type DeleteScope = 'SINGLE' | 'RANGE' | 'ALL_RECURRING';

// ─── Entity Interfaces ───────────────────────────────────────────────────────

export interface Category {
  id: string;
  owner_id: string | null;
  name: string;
  icon_path: string;
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

export interface Streaks {
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

// ─── API Request / Response Types ────────────────────────────────────────────

export interface PaginationMeta {
  current_page: number;
  page_size: number;
  total_pages: number;
  total_records: number;
  next_page: string | null;
  prev_page: string | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}

export interface ConflictCheck {
  has_conflict: boolean;
  conflicting_tasks: {
    id: string;
    title: string;
    start_time: string;
    end_time: string;
  }[];
}

export interface CreateTaskTemplateInput {
  category_id: string;
  title: string;
  description?: string;
  start_date: string;
  due_date?: string;
  start_time: string;
  time_to_complete: number;
  reminder_enabled?: boolean;
  recurrence_type: RecurrenceType;
  recurrence_interval?: RecurrenceInterval;
  custom_days?: string;
}

export interface CreateTaskOccurrenceInput {
  category_id: string;
  date: string;
  title: string;
  description?: string;
  start_time: string;
  time_to_complete: number;
  reminder_enabled?: boolean;
}

export interface UpdateTaskOccurrenceInput {
  title?: string;
  description?: string;
  category_id?: string;
  start_time?: string;
  time_to_complete?: number;
  status?: TaskStatus;
  elapsed_time?: number;
  reminder_enabled?: boolean;
  decouple?: boolean;
}

export interface DashboardStreaks {
  current_streak: number;
  longest_streak: number;
  last_completed_date: string | null;
}

export interface TimeSpentDataPoint {
  date: string;
  total_seconds_spent: number;
}

export interface CompletionRateDataPoint {
  date: string;
  completed_count: number;
  total_count: number;
  completion_rate: number;
}

export interface ActiveTimerSession {
  id: string;
  task_occurrence_id: string;
  start_time: string;
  is_active: boolean;
}

export interface PlayTimerResponse {
  session_id: string;
  task_occurrence_id: string;
  start_time: string;
  is_active: boolean;
  paused_session?: {
    task_occurrence_id: string;
    elapsed_accumulated: number;
  };
}

// ─── System Categories ───────────────────────────────────────────────────────

export const SYSTEM_CATEGORIES: Omit<Category, 'created_at' | 'updated_at' | 'deleted_at' | 'sync_version'>[] = [
  { id: '00000000-0000-0000-0000-000000000001', owner_id: null, name: 'Work',     icon_path: '/assets/icons/work.png',     is_system: true, color_hex: '#2196F3' },
  { id: '00000000-0000-0000-0000-000000000002', owner_id: null, name: 'Personal', icon_path: '/assets/icons/personal.png', is_system: true, color_hex: '#9C27B0' },
  { id: '00000000-0000-0000-0000-000000000003', owner_id: null, name: 'Study',    icon_path: '/assets/icons/study.png',    is_system: true, color_hex: '#FF9800' },
  { id: '00000000-0000-0000-0000-000000000004', owner_id: null, name: 'Health',   icon_path: '/assets/icons/health.png',   is_system: true, color_hex: '#4CAF50' },
  { id: '00000000-0000-0000-0000-000000000005', owner_id: null, name: 'Life',     icon_path: '/assets/icons/life.png',     is_system: true, color_hex: '#F44336' },
  { id: '00000000-0000-0000-0000-000000000006', owner_id: null, name: 'Others',   icon_path: '/assets/icons/others.png',   is_system: true, color_hex: '#9E9E9E' },
];

export const OTHERS_CATEGORY_ID = '00000000-0000-0000-0000-000000000006';
