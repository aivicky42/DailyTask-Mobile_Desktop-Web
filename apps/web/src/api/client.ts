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

const BASE = '/api/v1';

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
  const res = await fetch(`${BASE}${path}`, {
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

// ── Categories ──────────────────────────────────────────────────────────────

export function getCategories(): Promise<Category[]> {
  return request<Category[]>('/categories');
}

export function createCategory(
  data: Pick<Category, 'name' | 'icon_path' | 'color_hex'>,
): Promise<Category> {
  return request<Category>('/categories', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateCategory(
  id: string,
  data: Partial<Pick<Category, 'name' | 'icon_path' | 'color_hex'>>,
): Promise<Category> {
  return request<Category>(`/categories/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function deleteCategory(id: string): Promise<void> {
  return request<void>(`/categories/${id}`, { method: 'DELETE' });
}

// ── Task Templates ───────────────────────────────────────────────────────────

export function getTaskTemplates(): Promise<TaskTemplate[]> {
  return request<TaskTemplate[]>('/task-templates');
}

export function createTaskTemplate(
  data: Omit<
    TaskTemplate,
    'id' | 'owner_id' | 'created_at' | 'updated_at' | 'deleted_at' | 'sync_version'
  >,
): Promise<TaskTemplate> {
  return request<TaskTemplate>('/task-templates', {
    method: 'POST',
    body: JSON.stringify(data),
  });
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
  return request<TaskTemplate>(`/task-templates/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function deleteTaskTemplate(id: string): Promise<void> {
  return request<void>(`/task-templates/${id}`, { method: 'DELETE' });
}

export function generateToday(): Promise<void> {
  return request<void>('/task-templates/generate-today', { method: 'POST' });
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
  const qs = new URLSearchParams(params).toString();
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
  return request<TaskOccurrence>('/task-occurrences', {
    method: 'POST',
    body: JSON.stringify(data),
  });
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
  return request<TaskOccurrence>(`/task-occurrences/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function deleteTaskOccurrence(
  id: string,
  scope?: DeleteScope,
  date_range?: { start: string; end: string },
): Promise<void> {
  return request<void>(`/task-occurrences/${id}`, {
    method: 'DELETE',
    body: JSON.stringify({ scope, date_range }),
  });
}

// ── Conflict Check ───────────────────────────────────────────────────────────

export function checkConflict(data: {
  date: string;
  start_time: string;
  time_to_complete: number;
  exclude_id?: string;
}): Promise<ConflictCheck> {
  return request<ConflictCheck>('/task-occurrences/check-conflict', {
    method: 'POST',
    body: JSON.stringify(data),
  });
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
  const res = await request<TimerPlayResponse>('/timer-sessions/play', {
    method: 'POST',
    body: JSON.stringify({ task_occurrence_id }),
  });
  return res.session;
}

export async function pauseTimer(): Promise<TimerSession> {
  const res = await request<TimerPauseResponse>('/timer-sessions/pause', { method: 'POST' });
  return res.session;
}

export async function getActiveTimer(): Promise<ActiveTimerInfo | null> {
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
  return request<Settings>('/settings');
}

export function updateSettings(data: Partial<Settings>): Promise<Settings> {
  return request<Settings>('/settings', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// ── Dashboard & Analytics ────────────────────────────────────────────────────

export function getDashboardStreaks(): Promise<DashboardStreaks> {
  return request<DashboardStreaks>('/dashboard/streaks');
}

export function getTimeSpent(
  start_date: string,
  end_date: string,
): Promise<TimeSpentDataPoint[]> {
  return request<TimeSpentDataPoint[]>(
    `/dashboard/analytics/time-spent?start_date=${start_date}&end_date=${end_date}`,
  );
}

export function getCompletionRate(
  start_date: string,
  end_date: string,
): Promise<CompletionRateDataPoint[]> {
  return request<CompletionRateDataPoint[]>(
    `/dashboard/analytics/completion-rate?start_date=${start_date}&end_date=${end_date}`,
  );
}
