import {
  ActiveTimer,
  Category,
  CompletionRateEntry,
  ConflictCheck,
  DashboardStreaks,
  Settings,
  TaskOccurrence,
  TaskTemplate,
  TimeSpentEntry,
  RecurrenceType,
  RecurrenceInterval,
  DeleteScope,
} from '../types';
import { loadNotificationsModule } from '../lib/notifications';
import { setLastSyncAt } from '../lib/appConfig';
import {
  isCloudMode,
  cloudGetCategories,
  cloudCreateCategory,
  cloudUpdateCategory,
  cloudDeleteCategory,
  cloudGetTaskTemplates,
  cloudCreateTaskTemplate,
  cloudUpdateTaskTemplate,
  cloudDeleteTaskTemplate,
  cloudGenerateToday,
  cloudGenerateForRange,
  cloudGetTaskOccurrences,
  cloudCreateTaskOccurrence,
  cloudUpdateTaskOccurrence,
  cloudDeleteTaskOccurrence,
  cloudCheckConflict,
  cloudPlayTimer,
  cloudPauseTimer,
  cloudGetActiveTimer,
  cloudGetSettings,
  cloudUpdateSettings,
  cloudGetDashboardStreaks,
  cloudGetTimeSpent,
  cloudGetCompletionRate,
  cloudSyncNow,
} from '../lib/cloudData';
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

interface SyncResponse {
  server_changes: {
    categories: Category[];
    task_templates: TaskTemplate[];
    task_occurrences: TaskOccurrence[];
    timer_sessions: ActiveTimer[];
    reminders: Record<string, unknown>[];
    settings: Settings[];
    streaks: Record<string, unknown>[];
  };
  synced_at: string;
}

// Categories
export function getCategories(): Promise<Category[]> {
  return useCloud().then((cloud) => (cloud ? cloudGetCategories() : localGetCategories()));
}

export function createCategory(data: { name: string; color_hex: string; icon_path: string }): Promise<Category> {
  return useCloud().then((cloud) => (cloud ? cloudCreateCategory(data) : localCreateCategory(data)));
}

export function updateCategory(
  id: string,
  data: Partial<{ name: string; color_hex: string; icon_path: string }>,
): Promise<Category> {
  return useCloud().then((cloud) => (cloud ? cloudUpdateCategory(id, data) : localUpdateCategory(id, data)));
}

export function deleteCategory(id: string): Promise<void> {
  return useCloud().then((cloud) => (cloud ? cloudDeleteCategory(id) : localDeleteCategory(id)));
}

// Task templates
export function getTaskTemplates(): Promise<TaskTemplate[]> {
  return useCloud().then((cloud) => (cloud ? cloudGetTaskTemplates() : localGetTaskTemplates()));
}

export function createTaskTemplate(data: {
  category_id: string;
  title: string;
  description?: string;
  start_date: string;
  due_date?: string;
  start_time: string;
  time_to_complete: number;
  reminder_enabled: boolean;
  recurrence_type: RecurrenceType;
  recurrence_interval?: RecurrenceInterval;
  custom_days?: string;
}): Promise<TaskTemplate> {
  return useCloud().then((cloud) => (cloud ? cloudCreateTaskTemplate(data as any) : localCreateTaskTemplate(data)));
}

export function updateTaskTemplate(
  id: string,
  data: Partial<{
    category_id: string;
    title: string;
    description: string;
    start_date: string;
    due_date: string;
    start_time: string;
    time_to_complete: number;
    reminder_enabled: boolean;
    recurrence_type: RecurrenceType;
    recurrence_interval: RecurrenceInterval;
    custom_days: string;
  }>,
): Promise<TaskTemplate> {
  return useCloud().then((cloud) => (cloud ? cloudUpdateTaskTemplate(id, data as any) : localUpdateTaskTemplate(id, data as any)));
}

export function deleteTaskTemplate(id: string): Promise<void> {
  return useCloud().then((cloud) => (cloud ? cloudDeleteTaskTemplate(id) : localDeleteTaskTemplate(id)));
}

export function generateToday(): Promise<{ generated: number }> {
  return useCloud().then((cloud) => (cloud ? cloudGenerateToday() : localGenerateToday()));
}

export function generateForRange(start_date: string, end_date: string): Promise<{ generated?: number } | void> {
  return useCloud().then((cloud) => (cloud ? cloudGenerateForRange(start_date, end_date) : localGenerateForRange(start_date, end_date)));
}

// Sync (cloud only — local mode has nothing remote to pull)
export async function syncWithServer(): Promise<SyncResponse> {
  if (!(await useCloud())) {
    throw new Error('Enable Sync & sign in to sync across devices. Local-only mode stores data on this device.');
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

// Task occurrences
export interface GetOccurrencesParams {
  date?: string;
  start_date?: string;
  end_date?: string;
  status?: string;
  category_id?: string;
}

export async function getTaskOccurrences(params?: GetOccurrencesParams): Promise<TaskOccurrence[]> {
  return useCloud().then((cloud) => (cloud ? cloudGetTaskOccurrences(params ?? {}) : localGetTaskOccurrences(params ?? {})));
}

export function createTaskOccurrence(data: {
  category_id: string;
  title: string;
  description?: string;
  date: string;
  start_time: string;
  time_to_complete: number;
  reminder_enabled: boolean;
  recurrence_type?: RecurrenceType;
  recurrence_interval?: RecurrenceInterval;
  custom_days?: string;
  due_date?: string;
}): Promise<TaskOccurrence> {
  return useCloud().then((cloud) => (cloud ? cloudCreateTaskOccurrence(data as any) : localCreateTaskOccurrence(data)));
}

export function updateTaskOccurrence(
  id: string,
  data: Partial<{
    title: string;
    description: string;
    date: string;
    start_time: string;
    time_to_complete: number;
    category_id: string;
    status: string;
    reminder_enabled: boolean;
    elapsed_time: number;
  }>,
): Promise<TaskOccurrence> {
  return useCloud().then((cloud) => (cloud ? cloudUpdateTaskOccurrence(id, data as any) : localUpdateTaskOccurrence(id, data as any)));
}

export function deleteTaskOccurrence(
  id: string,
  params?: { scope?: DeleteScope; end_date?: string },
): Promise<void> {
  return useCloud().then((cloud) =>
    cloud
      ? cloudDeleteTaskOccurrence(
          id,
          params?.scope,
          params?.end_date ? { start: params.end_date, end: params.end_date } : undefined,
        )
      : localDeleteTaskOccurrence(
          id,
          params?.scope,
          params?.end_date ? { start: params.end_date, end: params.end_date } : undefined,
        ),
  );
}

export function checkConflict(data: {
  date: string;
  start_time: string;
  time_to_complete: number;
  exclude_id?: string;
}): Promise<ConflictCheck> {
  return useCloud().then((cloud) => (cloud ? cloudCheckConflict(data) : localCheckConflict(data)));
}

// Timer
export async function playTimer(task_occurrence_id: string): Promise<ActiveTimer> {
  const session = await useCloud().then((cloud) =>
    cloud ? cloudPlayTimer(task_occurrence_id) : localPlayTimer(task_occurrence_id),
  );
  return {
    id: session.id,
    task_occurrence_id: session.task_occurrence_id,
    start_time: session.start_time,
    is_active: session.is_active,
  };
}

export async function pauseTimer(): Promise<ActiveTimer> {
  const session = await useCloud().then((cloud) => (cloud ? cloudPauseTimer() : localPauseTimer()));
  return {
    id: session.id,
    task_occurrence_id: session.task_occurrence_id,
    start_time: session.start_time,
    is_active: session.is_active,
  };
}

export async function getActiveTimer(): Promise<ActiveTimer | null> {
  const result = await useCloud().then((cloud) => (cloud ? cloudGetActiveTimer() : localGetActiveTimer()));
  if (!result) return null;
  return {
    id: result.session.id,
    task_occurrence_id: result.session.task_occurrence_id,
    start_time: result.session.start_time,
    is_active: result.session.is_active,
  };
}

// Settings
export function getSettings(): Promise<Settings> {
  return useCloud().then((cloud) => (cloud ? cloudGetSettings() : localGetSettings()));
}

export function updateSettings(data: Partial<Settings>): Promise<Settings> {
  return useCloud().then((cloud) => (cloud ? cloudUpdateSettings(data) : localUpdateSettings(data)));
}

// Dashboard
export function getDashboardStreaks(): Promise<DashboardStreaks> {
  return useCloud().then((cloud) => (cloud ? cloudGetDashboardStreaks() : localGetDashboardStreaks()));
}

export function getTimeSpent(start_date: string, end_date: string): Promise<TimeSpentEntry[]> {
  return useCloud().then((cloud) => (cloud ? cloudGetTimeSpent(start_date, end_date) : localGetTimeSpent(start_date, end_date)));
}

export function getCompletionRate(start_date: string, end_date: string): Promise<CompletionRateEntry[]> {
  return useCloud().then((cloud) => (cloud ? cloudGetCompletionRate(start_date, end_date) : localGetCompletionRate(start_date, end_date)));
}

// Notifications
export async function scheduleTaskReminder(task: TaskOccurrence, minutesBefore: number): Promise<string | null> {
  try {
    const Notifications = await loadNotificationsModule();
    if (!Notifications) return null;

    const [h, m] = task.start_time.split(':').map(Number);
    const reminderDate = new Date(task.date);
    reminderDate.setHours(h ?? 0, (m ?? 0) - minutesBefore, 0, 0);

    if (reminderDate <= new Date()) return null;

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: `⏰ ${task.title}`,
        body: `Starting in ${minutesBefore} minute${minutesBefore !== 1 ? 's' : ''}`,
        data: { taskId: task.id },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: reminderDate },
    });
    return id;
  } catch {
    return null;
  }
}

export async function cancelTaskReminder(notificationId: string): Promise<void> {
  const Notifications = await loadNotificationsModule();
  if (!Notifications) return;
  await Notifications.cancelScheduledNotificationAsync(notificationId);
}
