export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'COMPLETED';
export type RecurrenceType = 'NONE' | 'DAILY' | 'RECURRING' | 'CUSTOM';
export type RecurrenceInterval = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
export type ThemeMode = 'light' | 'dark' | 'system';
export type DeleteScope = 'SINGLE' | 'RANGE' | 'ALL_RECURRING';

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

export interface Settings {
  id: string;
  theme: ThemeMode;
  default_reminder: number;
  week_start: string;
  default_duration: number;
  notification_sound: string;
  language: string;
  timezone: string;
  sync_version: number;
}

export interface DashboardStreaks {
  current_streak: number;
  longest_streak: number;
  last_completed_date: string | null;
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

export interface ActiveTimer {
  id: string;
  task_occurrence_id: string;
  start_time: string;
  is_active: boolean;
}

export interface TimeSpentEntry {
  date: string;
  total_seconds: number;
}

export interface CompletionRateEntry {
  date: string;
  total: number;
  completed: number;
  rate: number;
}

// ─── Navigation ─────────────────────────────────────────────────────────────
export type RootStackParamList = {
  MainTabs: undefined;
};

export type MainTabParamList = {
  Dashboard: undefined;
  Tasks: undefined;
  Calendar: undefined;
  Settings: undefined;
};
