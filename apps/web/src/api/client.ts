import type {
  Category,
  TaskTemplate,
  TaskOccurrence,
  TimerSession,
  Settings,
  DashboardStreaks,
  TimeSpentDataPoint,
  CompletionRateDataPoint,
  ConflictCheck,
  DeleteScope,
} from '../types';
import { setLastSyncAt } from '../lib/appConfig';
import { isCloudMode, cloudGetCategories, cloudCreateCategory, cloudUpdateCategory, cloudDeleteCategory, cloudGetTaskTemplates, cloudCreateTaskTemplate, cloudUpdateTaskTemplate, cloudDeleteTaskTemplate, cloudGenerateToday, cloudGenerateForRange, cloudGetTaskOccurrences, cloudCreateTaskOccurrence, cloudUpdateTaskOccurrence, cloudDeleteTaskOccurrence, cloudCheckConflict, cloudPlayTimer, cloudPauseTimer, cloudGetActiveTimer, cloudGetSettings, cloudUpdateSettings, cloudGetDashboardStreaks, cloudGetTimeSpent, cloudGetCompletionRate, cloudSyncNow } from '../lib/cloudData';
import {
  localGetCategories,
  localCreateCategory,
  localUpdateCategory,
  localDeleteCategory,
  localGetTaskTemplates,
  localCreateTaskTemplate,
  localUpdateTaskTemplate,
  localDeleteTaskTemplate,
  localGenerateToday,
  localGenerateForRange,
  localGetTaskOccurrences,
  localCreateTaskOccurrence,
  localUpdateTaskOccurrence,
  localDeleteTaskOccurrence,
  localCheckConflict,
  localPlayTimer,
  localPauseTimer,
  localGetActiveTimer,
  localGetSettings,
  localUpdateSettings,
  localGetDashboardStreaks,
  localGetTimeSpent,
  localGetCompletionRate,
} from '../lib/localData';

async function useCloud(): Promise<boolean> {
  return isCloudMode();
}

// ── Categories ──────────────────────────────────────────────────────────────

export function getCategories(): Promise<Category[]> {
  return useCloud().then((cloud) => (cloud ? cloudGetCategories() : localGetCategories()));
}

export function createCategory(
  data: Pick<Category, 'name' | 'icon_path' | 'color_hex'>,
): Promise<Category> {
  return useCloud().then((cloud) => (cloud ? cloudCreateCategory(data) : localCreateCategory(data)));
}

export function updateCategory(
  id: string,
  data: Partial<Pick<Category, 'name' | 'icon_path' | 'color_hex'>>,
): Promise<Category> {
  return useCloud().then((cloud) => (cloud ? cloudUpdateCategory(id, data) : localUpdateCategory(id, data)));
}

export function deleteCategory(id: string): Promise<void> {
  return useCloud().then((cloud) => (cloud ? cloudDeleteCategory(id) : localDeleteCategory(id)));
}

// ── Task Templates ───────────────────────────────────────────────────────────

export function getTaskTemplates(): Promise<TaskTemplate[]> {
  return useCloud().then((cloud) => (cloud ? cloudGetTaskTemplates() : localGetTaskTemplates()));
}

export function createTaskTemplate(
  data: Omit<
    TaskTemplate,
    'id' | 'owner_id' | 'created_at' | 'updated_at' | 'deleted_at' | 'sync_version'
  >,
): Promise<TaskTemplate> {
  return useCloud().then((cloud) => (cloud ? cloudCreateTaskTemplate(data as any) : localCreateTaskTemplate(data)));
}

export function updateTaskTemplate(
  id: string,
  data: Partial<
    Omit<
      TaskTemplate,
      'id' | 'owner_id' | 'created_at' | 'updated_at' | 'deleted_at' | 'sync_version'
    >
  >,
): Promise<TaskTemplate> {
  return useCloud().then((cloud) => (cloud ? cloudUpdateTaskTemplate(id, data as any) : localUpdateTaskTemplate(id, data as any)));
}

export function deleteTaskTemplate(id: string): Promise<void> {
  return useCloud().then((cloud) => (cloud ? cloudDeleteTaskTemplate(id) : localDeleteTaskTemplate(id)));
}

export function generateToday(): Promise<void> {
  return useCloud().then((cloud) =>
    cloud ? cloudGenerateToday().then(() => undefined) : localGenerateToday().then(() => undefined),
  );
}

export function generateForRange(start_date: string, end_date: string): Promise<void> {
  return useCloud().then((cloud) =>
    cloud
      ? cloudGenerateForRange(start_date, end_date).then(() => undefined)
      : localGenerateForRange(start_date, end_date).then(() => undefined),
  );
}

interface SyncResponse {
  server_changes: {
    categories: Category[];
    task_templates: TaskTemplate[];
    task_occurrences: TaskOccurrence[];
    timer_sessions: TimerSession[];
    reminders: Record<string, unknown>[];
    settings: Settings[];
    streaks: Record<string, unknown>[];
  };
  synced_at: string;
}

export async function syncWithServer(): Promise<SyncResponse> {
  if (!(await useCloud())) {
    throw new Error('Enable Sync & sign in to sync across devices. Local-only mode stores data in this browser.');
  }
  const { synced_at } = await cloudSyncNow();
  await setLastSyncAt(synced_at);
  return {
    server_changes: {
      categories: [],
      task_templates: [],
      task_occurrences: [],
      timer_sessions: [],
      reminders: [],
      settings: [],
      streaks: [],
    },
    synced_at,
  };
}

// ── Task Occurrences ─────────────────────────────────────────────────────────

export async function getTaskOccurrences(
  params: Record<string, string>,
): Promise<TaskOccurrence[]> {
  return useCloud().then((cloud) => (cloud ? cloudGetTaskOccurrences(params) : localGetTaskOccurrences(params)));
}

export function createTaskOccurrence(
  data: Omit<
    TaskOccurrence,
    | 'id'
    | 'owner_id'
    | 'task_template_id'
    | 'is_detached'
    | 'created_at'
    | 'updated_at'
    | 'deleted_at'
    | 'sync_version'
  >,
): Promise<TaskOccurrence> {
  return useCloud().then((cloud) => (cloud ? cloudCreateTaskOccurrence(data as any) : localCreateTaskOccurrence(data)));
}

export function updateTaskOccurrence(
  id: string,
  data: Partial<
    Omit<
      TaskOccurrence,
      'id' | 'owner_id' | 'created_at' | 'updated_at' | 'deleted_at' | 'sync_version'
    >
  >,
): Promise<TaskOccurrence> {
  return useCloud().then((cloud) => (cloud ? cloudUpdateTaskOccurrence(id, data as any) : localUpdateTaskOccurrence(id, data as any)));
}

export function deleteTaskOccurrence(
  id: string,
  scope?: DeleteScope,
  date_range?: { start: string; end: string },
): Promise<void> {
  return useCloud().then((cloud) =>
    cloud ? cloudDeleteTaskOccurrence(id, scope, date_range) : localDeleteTaskOccurrence(id, scope, date_range),
  );
}

// ── Conflict Check ───────────────────────────────────────────────────────────

export function checkConflict(data: {
  date: string;
  start_time: string;
  time_to_complete: number;
  exclude_id?: string;
}): Promise<ConflictCheck> {
  return useCloud().then((cloud) => (cloud ? cloudCheckConflict(data) : localCheckConflict(data)));
}

/** Info returned when an active timer is restored on app start. */
export interface ActiveTimerInfo {
  session: TimerSession;
  /** Seconds already accumulated in task_occurrences.elapsed_time BEFORE this session. */
  baseElapsed: number;
}

export async function playTimer(task_occurrence_id: string): Promise<TimerSession> {
  return useCloud().then((cloud) =>
    cloud ? cloudPlayTimer(task_occurrence_id) : localPlayTimer(task_occurrence_id),
  );
}

export async function pauseTimer(): Promise<TimerSession> {
  return useCloud().then((cloud) => (cloud ? cloudPauseTimer() : localPauseTimer()));
}

export async function getActiveTimer(): Promise<ActiveTimerInfo | null> {
  const result = await useCloud().then((cloud) => (cloud ? cloudGetActiveTimer() : localGetActiveTimer()));
  return result ? { session: result.session, baseElapsed: result.baseElapsed } : null;
}

// ── Settings ─────────────────────────────────────────────────────────────────

export function getSettings(): Promise<Settings> {
  return useCloud().then((cloud) => (cloud ? cloudGetSettings() : localGetSettings()));
}

export function updateSettings(data: Partial<Settings>): Promise<Settings> {
  return useCloud().then((cloud) => (cloud ? cloudUpdateSettings(data) : localUpdateSettings(data)));
}

// ── Dashboard & Analytics ────────────────────────────────────────────────────

export function getDashboardStreaks(): Promise<DashboardStreaks> {
  return useCloud().then((cloud) => (cloud ? cloudGetDashboardStreaks() : localGetDashboardStreaks()));
}

export function getTimeSpent(
  start_date: string,
  end_date: string,
): Promise<TimeSpentDataPoint[]> {
  return useCloud().then((cloud) => (cloud ? cloudGetTimeSpent(start_date, end_date) : localGetTimeSpent(start_date, end_date)));
}

export function getCompletionRate(
  start_date: string,
  end_date: string,
): Promise<CompletionRateDataPoint[]> {
  return useCloud().then((cloud) => (cloud ? cloudGetCompletionRate(start_date, end_date) : localGetCompletionRate(start_date, end_date)));
}
