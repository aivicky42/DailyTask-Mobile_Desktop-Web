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
import { getApiBaseUrl, getLastSyncAt, setLastSyncAt } from '../lib/appConfig';
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

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const baseUrl = await getApiBaseUrl();
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    try {
      const body = await response.json();
      if (body.message) errorMessage = body.message;
      if (body.error) errorMessage = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(errorMessage);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

function get<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'GET' });
}

function post<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined });
}

function put<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined });
}

function patch<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined });
}

function del<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, { method: 'DELETE', body: body ? JSON.stringify(body) : undefined });
}

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
  return useCloud().then((cloud) => (cloud ? cloudGetCategories() : get<Category[]>('/categories')));
}

export function createCategory(data: { name: string; color_hex: string; icon_path: string }): Promise<Category> {
  return useCloud().then((cloud) => (cloud ? cloudCreateCategory(data) : post<Category>('/categories', data)));
}

export function updateCategory(
  id: string,
  data: Partial<{ name: string; color_hex: string; icon_path: string }>,
): Promise<Category> {
  return useCloud().then((cloud) => (cloud ? cloudUpdateCategory(id, data) : patch<Category>(`/categories/${id}`, data)));
}

export function deleteCategory(id: string): Promise<void> {
  return useCloud().then((cloud) => (cloud ? cloudDeleteCategory(id) : del<void>(`/categories/${id}`)));
}

// Task templates
export function getTaskTemplates(): Promise<TaskTemplate[]> {
  return useCloud().then((cloud) => (cloud ? cloudGetTaskTemplates() : get<TaskTemplate[]>('/task-templates')));
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
  return useCloud().then((cloud) => (cloud ? cloudCreateTaskTemplate(data as any) : post<TaskTemplate>('/task-templates', data)));
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
  return useCloud().then((cloud) => (cloud ? cloudUpdateTaskTemplate(id, data as any) : put<TaskTemplate>(`/task-templates/${id}`, data)));
}

export function deleteTaskTemplate(id: string): Promise<void> {
  return useCloud().then((cloud) => (cloud ? cloudDeleteTaskTemplate(id) : del<void>(`/task-templates/${id}`)));
}

export function generateToday(): Promise<{ generated: number }> {
  return useCloud().then((cloud) =>
    cloud
      ? cloudGenerateToday()
      : post<{ generated: number }>('/task-templates/generate-today'),
  );
}

export function generateForRange(start_date: string, end_date: string): Promise<{ generated?: number } | void> {
  return useCloud().then((cloud) =>
    cloud
      ? cloudGenerateForRange(start_date, end_date)
      : post('/task-templates/generate-range', { start_date, end_date }),
  );
}

// Sync
export async function syncWithServer(): Promise<SyncResponse> {
  if (await useCloud()) {
    const { synced_at } = await cloudSyncNow();
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

  const lastSyncedAt = await getLastSyncAt();
  const response = await request<SyncResponse>('/sync', {
    method: 'POST',
    body: JSON.stringify({ last_synced_at: lastSyncedAt, changes: {} }),
  });
  await setLastSyncAt(response.synced_at);
  return response;
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
  if (await useCloud()) return cloudGetTaskOccurrences(params ?? {});

  const searchParams = new URLSearchParams();
  searchParams.set('page_size', '100');
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.set(key, value);
      }
    });
  }

  const query = searchParams.toString();
  const response = await get<TaskOccurrence[] | { data: TaskOccurrence[] }>(`/task-occurrences${query ? `?${query}` : ''}`);
  return Array.isArray(response) ? response : response.data ?? [];
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
  return useCloud().then((cloud) => (cloud ? cloudCreateTaskOccurrence(data as any) : post<TaskOccurrence>('/task-occurrences', data)));
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
  return useCloud().then((cloud) => (cloud ? cloudUpdateTaskOccurrence(id, data as any) : patch<TaskOccurrence>(`/task-occurrences/${id}`, data)));
}

export function deleteTaskOccurrence(
  id: string,
  params?: { scope?: DeleteScope; end_date?: string },
): Promise<void> {
  return useCloud().then((cloud) => {
    if (cloud) {
      return cloudDeleteTaskOccurrence(
        id,
        params?.scope,
        params?.end_date ? { start: params.end_date, end: params.end_date } : undefined,
      );
    }
    const search = new URLSearchParams();
    if (params?.scope) search.set('scope', params.scope);
    if (params?.end_date) search.set('end_date', params.end_date);
    const qs = search.toString();
    return request<void>(`/task-occurrences/${id}${qs ? `?${qs}` : ''}`, { method: 'DELETE' });
  });
}

export function checkConflict(data: {
  date: string;
  start_time: string;
  time_to_complete: number;
  exclude_id?: string;
}): Promise<ConflictCheck> {
  return useCloud().then((cloud) => (cloud ? cloudCheckConflict(data) : post<ConflictCheck>('/task-occurrences/conflict-check', data)));
}

// Timer
export async function playTimer(task_occurrence_id: string): Promise<ActiveTimer> {
  if (await useCloud()) {
    const session = await cloudPlayTimer(task_occurrence_id);
    return {
      id: session.id,
      task_occurrence_id: session.task_occurrence_id,
      start_time: session.start_time,
      is_active: session.is_active,
    };
  }
  return post<ActiveTimer>('/timers/play', { task_occurrence_id });
}

export async function pauseTimer(): Promise<ActiveTimer> {
  if (await useCloud()) {
    const session = await cloudPauseTimer();
    return {
      id: session.id,
      task_occurrence_id: session.task_occurrence_id,
      start_time: session.start_time,
      is_active: session.is_active,
    };
  }
  return post<ActiveTimer>('/timers/pause');
}

export async function getActiveTimer(): Promise<ActiveTimer | null> {
  if (await useCloud()) {
    const result = await cloudGetActiveTimer();
    if (!result) return null;
    return {
      id: result.session.id,
      task_occurrence_id: result.session.task_occurrence_id,
      start_time: result.session.start_time,
      is_active: result.session.is_active,
    };
  }
  return get<ActiveTimer | null>('/timers/active');
}

// Settings
export function getSettings(): Promise<Settings> {
  return useCloud().then((cloud) => (cloud ? cloudGetSettings() : get<Settings>('/settings')));
}

export function updateSettings(data: Partial<Settings>): Promise<Settings> {
  return useCloud().then((cloud) => (cloud ? cloudUpdateSettings(data) : patch<Settings>('/settings', data)));
}

// Dashboard
export function getDashboardStreaks(): Promise<DashboardStreaks> {
  return useCloud().then((cloud) => (cloud ? cloudGetDashboardStreaks() : get<DashboardStreaks>('/dashboard/streaks')));
}

export function getTimeSpent(start_date: string, end_date: string): Promise<TimeSpentEntry[]> {
  return useCloud().then((cloud) => (cloud ? cloudGetTimeSpent(start_date, end_date) : get<TimeSpentEntry[]>(`/dashboard/time-spent?start_date=${start_date}&end_date=${end_date}`)));
}

export function getCompletionRate(start_date: string, end_date: string): Promise<CompletionRateEntry[]> {
  return useCloud().then((cloud) => (cloud ? cloudGetCompletionRate(start_date, end_date) : get<CompletionRateEntry[]>(`/dashboard/completion-rate?start_date=${start_date}&end_date=${end_date}`)));
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
