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

// ⚠️  Change this to your PC's local IP when testing on a physical device.
// Find it by running `ipconfig` (Windows) or `ifconfig` (Mac/Linux) in a terminal.
// Example: 'http://192.168.1.105:3000/api/v1'
const BASE_URL = 'http://localhost:3000/api/v1';

// ─── HTTP Helper ─────────────────────────────────────────────────────────────

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const response = await fetch(url, {
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
    } catch {}
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

// ─── Categories ──────────────────────────────────────────────────────────────

export function getCategories(): Promise<Category[]> {
  return get<Category[]>('/categories');
}

export function createCategory(data: {
  name: string;
  color_hex: string;
  icon_path: string;
}): Promise<Category> {
  return post<Category>('/categories', data);
}

export function updateCategory(
  id: string,
  data: Partial<{ name: string; color_hex: string; icon_path: string }>
): Promise<Category> {
  return put<Category>(`/categories/${id}`, data);
}

export function deleteCategory(id: string): Promise<void> {
  return del<void>(`/categories/${id}`);
}

// ─── Task Templates ───────────────────────────────────────────────────────────

export function getTaskTemplates(): Promise<TaskTemplate[]> {
  return get<TaskTemplate[]>('/task-templates');
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
  return post<TaskTemplate>('/task-templates', data);
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
  }>
): Promise<TaskTemplate> {
  return put<TaskTemplate>(`/task-templates/${id}`, data);
}

// ─── Task Occurrences ─────────────────────────────────────────────────────────

export interface GetOccurrencesParams {
  date?: string;
  start_date?: string;
  end_date?: string;
  status?: string;
  category_id?: string;
}

export function getTaskOccurrences(params?: GetOccurrencesParams): Promise<TaskOccurrence[]> {
  const searchParams = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.set(key, value);
      }
    });
  }
  const query = searchParams.toString();
  return get<TaskOccurrence[]>(`/task-occurrences${query ? `?${query}` : ''}`);
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
  return post<TaskOccurrence>('/task-occurrences', data);
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
  }>
): Promise<TaskOccurrence> {
  return patch<TaskOccurrence>(`/task-occurrences/${id}`, data);
}

export function deleteTaskOccurrence(
  id: string,
  params?: { scope?: DeleteScope; end_date?: string }
): Promise<void> {
  return del<void>(`/task-occurrences/${id}`, params);
}

// ─── Conflict Check ───────────────────────────────────────────────────────────

export function checkConflict(data: {
  date: string;
  start_time: string;
  time_to_complete: number;
  exclude_id?: string;
}): Promise<ConflictCheck> {
  return post<ConflictCheck>('/task-occurrences/conflict-check', data);
}

// ─── Timer ───────────────────────────────────────────────────────────────────

export function playTimer(task_occurrence_id: string): Promise<ActiveTimer> {
  return post<ActiveTimer>('/timers/play', { task_occurrence_id });
}

export function pauseTimer(): Promise<ActiveTimer> {
  return post<ActiveTimer>('/timers/pause');
}

export function getActiveTimer(): Promise<ActiveTimer | null> {
  return get<ActiveTimer | null>('/timers/active');
}

// ─── Settings ────────────────────────────────────────────────────────────────

export function getSettings(): Promise<Settings> {
  return get<Settings>('/settings');
}

export function updateSettings(data: Partial<Settings>): Promise<Settings> {
  return patch<Settings>('/settings', data);
}

// ─── Dashboard / Analytics ───────────────────────────────────────────────────

export function getDashboardStreaks(): Promise<DashboardStreaks> {
  return get<DashboardStreaks>('/dashboard/streaks');
}

export function getTimeSpent(start_date: string, end_date: string): Promise<TimeSpentEntry[]> {
  return get<TimeSpentEntry[]>(`/dashboard/time-spent?start_date=${start_date}&end_date=${end_date}`);
}

export function getCompletionRate(
  start_date: string,
  end_date: string
): Promise<CompletionRateEntry[]> {
  return get<CompletionRateEntry[]>(
    `/dashboard/completion-rate?start_date=${start_date}&end_date=${end_date}`
  );
}

export function generateToday(): Promise<{ generated: number }> {
  return post<{ generated: number }>('/task-occurrences/generate-today');
}

// ─── Notifications Helper ─────────────────────────────────────────────────────

import * as Notifications from 'expo-notifications';

export async function scheduleTaskReminder(
  task: TaskOccurrence,
  minutesBefore: number
): Promise<string | null> {
  try {
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
      trigger: { date: reminderDate },
    });
    return id;
  } catch {
    return null;
  }
}

export async function cancelTaskReminder(notificationId: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(notificationId);
}
