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
import { getApiBaseUrl, getLastSyncAt, setLastSyncAt } from '../lib/appConfig';
import { isCloudMode, cloudGetCategories, cloudCreateCategory, cloudUpdateCategory, cloudDeleteCategory, cloudGetTaskTemplates, cloudCreateTaskTemplate, cloudUpdateTaskTemplate, cloudDeleteTaskTemplate, cloudGenerateToday, cloudGenerateForRange, cloudGetTaskOccurrences, cloudCreateTaskOccurrence, cloudUpdateTaskOccurrence, cloudDeleteTaskOccurrence, cloudCheckConflict, cloudPlayTimer, cloudPauseTimer, cloudGetActiveTimer, cloudGetSettings, cloudUpdateSettings, cloudGetDashboardStreaks, cloudGetTimeSpent, cloudGetCompletionRate, cloudSyncNow } from '../lib/cloudData';

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const base = await getApiBaseUrl();
  const res = await fetch(`${base}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      message = body?.message ?? body?.error ?? message;
    } catch {
      /* ignore */
    }
    throw new ApiError(message, res.status);
  }

  // Handle 204 No Content
  if (res.status === 204) return undefined as unknown as T;

  return res.json() as Promise<T>;
}

async function useCloud(): Promise<boolean> {
  return isCloudMode();
}

// ── Categories ──────────────────────────────────────────────────────────────

export function getCategories(): Promise<Category[]> {
  return useCloud().then((cloud) => (cloud ? cloudGetCategories() : request<Category[]>('/categories')));
}

export function createCategory(
  data: Pick<Category, 'name' | 'icon_path' | 'color_hex'>,
): Promise<Category> {
  return useCloud().then((cloud) => (cloud ? cloudCreateCategory(data) : request<Category>('/categories', { method: 'POST', body: JSON.stringify(data) })));
}

export function updateCategory(
  id: string,
  data: Partial<Pick<Category, 'name' | 'icon_path' | 'color_hex'>>,
): Promise<Category> {
  return useCloud().then((cloud) => (cloud ? cloudUpdateCategory(id, data) : request<Category>(`/categories/${id}`, { method: 'PATCH', body: JSON.stringify(data) })));
}

export function deleteCategory(id: string): Promise<void> {
  return useCloud().then((cloud) => (cloud ? cloudDeleteCategory(id) : request<void>(`/categories/${id}`, { method: 'DELETE' })));
}

// ── Task Templates ───────────────────────────────────────────────────────────

export function getTaskTemplates(): Promise<TaskTemplate[]> {
  return useCloud().then((cloud) => (cloud ? cloudGetTaskTemplates() : request<TaskTemplate[]>('/task-templates')));
}

export function createTaskTemplate(
  data: Omit<
    TaskTemplate,
    'id' | 'owner_id' | 'created_at' | 'updated_at' | 'deleted_at' | 'sync_version'
  >,
): Promise<TaskTemplate> {
  return useCloud().then((cloud) => (cloud ? cloudCreateTaskTemplate(data as any) : request<TaskTemplate>('/task-templates', { method: 'POST', body: JSON.stringify(data) })));
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
  return useCloud().then((cloud) => (cloud ? cloudUpdateTaskTemplate(id, data as any) : request<TaskTemplate>(`/task-templates/${id}`, { method: 'PUT', body: JSON.stringify(data) })));
}

export function deleteTaskTemplate(id: string): Promise<void> {
  return useCloud().then((cloud) => (cloud ? cloudDeleteTaskTemplate(id) : request<void>(`/task-templates/${id}`, { method: 'DELETE' })));
}

export function generateToday(): Promise<void> {
  return useCloud().then((cloud) => (cloud ? cloudGenerateToday().then(() => undefined) : request<void>('/task-templates/generate-today', { method: 'POST' })));
}

export function generateForRange(start_date: string, end_date: string): Promise<void> {
  return useCloud().then((cloud) =>
    cloud
      ? cloudGenerateForRange(start_date, end_date).then(() => undefined)
      : request<void>('/task-templates/generate-range', {
          method: 'POST',
          body: JSON.stringify({ start_date, end_date }),
        }),
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

// ── Task Occurrences ─────────────────────────────────────────────────────────

interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    current_page: number;
    page_size: number;
    total_pages: number;
    total_records: number;
    next_page: string | null;
    prev_page: string | null;
  };
}

export async function getTaskOccurrences(
  params: Record<string, string>,
): Promise<TaskOccurrence[]> {
  if (await useCloud()) return cloudGetTaskOccurrences(params);
  const query = { page_size: '100', ...params };
  const qs = new URLSearchParams(query).toString();
  const res = await request<PaginatedResponse<TaskOccurrence> | TaskOccurrence[]>(`/task-occurrences?${qs}`);
  // The API returns a paginated envelope { data: [], pagination: {} } — unwrap it
  if (Array.isArray(res)) return res;
  return (res as PaginatedResponse<TaskOccurrence>).data ?? [];
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
  return useCloud().then((cloud) => (cloud ? cloudCreateTaskOccurrence(data as any) : request<TaskOccurrence>('/task-occurrences', { method: 'POST', body: JSON.stringify(data) })));
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
  return useCloud().then((cloud) => (cloud ? cloudUpdateTaskOccurrence(id, data as any) : request<TaskOccurrence>(`/task-occurrences/${id}`, { method: 'PUT', body: JSON.stringify(data) })));
}

export function deleteTaskOccurrence(
  id: string,
  scope?: DeleteScope,
  date_range?: { start: string; end: string },
): Promise<void> {
  return useCloud().then((cloud) => {
    if (cloud) return cloudDeleteTaskOccurrence(id, scope, date_range);
    const params = new URLSearchParams();
    if (scope) params.set('scope', scope);
    if (date_range?.start) params.set('start_date', date_range.start);
    if (date_range?.end) params.set('end_date', date_range.end);
    const qs = params.toString();
    return request<void>(`/task-occurrences/${id}${qs ? `?${qs}` : ''}`, { method: 'DELETE' });
  });
}

// ── Conflict Check ───────────────────────────────────────────────────────────

export function checkConflict(data: {
  date: string;
  start_time: string;
  time_to_complete: number;
  exclude_id?: string;
}): Promise<ConflictCheck> {
  return useCloud().then((cloud) => (cloud ? cloudCheckConflict(data) : request<ConflictCheck>('/task-occurrences/check-conflict', { method: 'POST', body: JSON.stringify(data) })));
}

// ── Timer ─────────────────────────────────────────────────────────────────────────────────

// The API wraps timer responses in { session, task_occurrence } envelopes.
// These internal types reflect the actual shapes returned by the server.
interface TimerPlayResponse {
  session: TimerSession;
  task_occurrence: TaskOccurrence;
}
interface TimerPauseResponse {
  session: TimerSession;
  task_occurrence: TaskOccurrence;
  elapsed_this_session_seconds: number;
}
interface TimerActiveResponse {
  session: TimerSession;
  current_session_elapsed_seconds: number;
  total_elapsed_seconds: number;
  task_occurrence: TaskOccurrence | null;
}

/** Info returned when an active timer is restored on app start. */
export interface ActiveTimerInfo {
  session: TimerSession;
  /** Seconds already accumulated in task_occurrences.elapsed_time BEFORE this session. */
  baseElapsed: number;
}

export async function playTimer(task_occurrence_id: string): Promise<TimerSession> {
  if (await useCloud()) return cloudPlayTimer(task_occurrence_id);
  const res = await request<TimerPlayResponse>('/timer-sessions/play', { method: 'POST', body: JSON.stringify({ task_occurrence_id }) });
  return res.session;
}

export async function pauseTimer(): Promise<TimerSession> {
  if (await useCloud()) return cloudPauseTimer();
  const res = await request<TimerPauseResponse>('/timer-sessions/pause', { method: 'POST' });
  return res.session;
}

export async function getActiveTimer(): Promise<ActiveTimerInfo | null> {
  if (await useCloud()) {
    const result = await cloudGetActiveTimer();
    return result ? { session: result.session, baseElapsed: result.baseElapsed } : null;
  }
  try {
    const res = await request<TimerActiveResponse>('/timer-sessions/active');
    if (!res?.session) return null;
    return {
      session: res.session,
      // elapsed_time stored on the occurrence is the pre-session base amount
      baseElapsed: res.task_occurrence?.elapsed_time ?? 0,
    };
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 204)) {
      return null;
    }
    throw err;
  }
}

// ── Settings ─────────────────────────────────────────────────────────────────

export function getSettings(): Promise<Settings> {
  return useCloud().then((cloud) => (cloud ? cloudGetSettings() : request<Settings>('/settings')));
}

export function updateSettings(data: Partial<Settings>): Promise<Settings> {
  return useCloud().then((cloud) => (cloud ? cloudUpdateSettings(data) : request<Settings>('/settings', { method: 'PUT', body: JSON.stringify(data) })));
}

// ── Dashboard & Analytics ────────────────────────────────────────────────────

export function getDashboardStreaks(): Promise<DashboardStreaks> {
  return useCloud().then((cloud) => (cloud ? cloudGetDashboardStreaks() : request<DashboardStreaks>('/dashboard/streaks')));
}

export function getTimeSpent(
  start_date: string,
  end_date: string,
): Promise<TimeSpentDataPoint[]> {
  return useCloud().then((cloud) => (cloud ? cloudGetTimeSpent(start_date, end_date) : request<TimeSpentDataPoint[]>(`/dashboard/analytics/time-spent?start_date=${start_date}&end_date=${end_date}`)));
}

export function getCompletionRate(
  start_date: string,
  end_date: string,
): Promise<CompletionRateDataPoint[]> {
  return useCloud().then((cloud) => (cloud ? cloudGetCompletionRate(start_date, end_date) : request<CompletionRateDataPoint[]>(`/dashboard/analytics/completion-rate?start_date=${start_date}&end_date=${end_date}`)));
}
