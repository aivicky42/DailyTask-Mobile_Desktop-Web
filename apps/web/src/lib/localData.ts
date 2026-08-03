import { format } from 'date-fns';
import type {
  Category,
  TaskTemplate,
  TaskOccurrence,
  Settings,
  DashboardStreaks,
  TimeSpentDataPoint,
  CompletionRateDataPoint,
  ConflictCheck,
  DeleteScope,
  TaskStatus,
  TimerSession,
  RecurrenceType,
  RecurrenceInterval,
} from '../types';

type GetOccurrencesParams = Record<string, string>;

const STORE_KEY = 'dailytask.local.db.v1';

const storage = {
  async getItem(key: string) {
    return window.localStorage.getItem(key);
  },
  async setItem(key: string, value: string) {
    window.localStorage.setItem(key, value);
  },
};

interface LocalDb {
  categories: Category[];
  templates: TaskTemplate[];
  occurrences: TaskOccurrence[];
  settings: Settings;
  streaks: DashboardStreaks;
  timers: TimerSession[];
}

function nowIso() {
  return new Date().toISOString();
}

function uid() {
  return crypto.randomUUID();
}

const SYSTEM_CATEGORIES: Category[] = [
  { id: '00000000-0000-0000-0000-000000000001', owner_id: null, name: 'Work', icon_path: '💼', is_system: true, color_hex: '#2196F3', created_at: nowIso(), updated_at: nowIso(), deleted_at: null, sync_version: 1 },
  { id: '00000000-0000-0000-0000-000000000002', owner_id: null, name: 'Personal', icon_path: '🏠', is_system: true, color_hex: '#9C27B0', created_at: nowIso(), updated_at: nowIso(), deleted_at: null, sync_version: 1 },
  { id: '00000000-0000-0000-0000-000000000003', owner_id: null, name: 'Study', icon_path: '🎓', is_system: true, color_hex: '#FF9800', created_at: nowIso(), updated_at: nowIso(), deleted_at: null, sync_version: 1 },
  { id: '00000000-0000-0000-0000-000000000004', owner_id: null, name: 'Health', icon_path: '💪', is_system: true, color_hex: '#4CAF50', created_at: nowIso(), updated_at: nowIso(), deleted_at: null, sync_version: 1 },
  { id: '00000000-0000-0000-0000-000000000005', owner_id: null, name: 'Life', icon_path: '🌿', is_system: true, color_hex: '#F44336', created_at: nowIso(), updated_at: nowIso(), deleted_at: null, sync_version: 1 },
  { id: '00000000-0000-0000-0000-000000000006', owner_id: null, name: 'Others', icon_path: '📁', is_system: true, color_hex: '#9E9E9E', created_at: nowIso(), updated_at: nowIso(), deleted_at: null, sync_version: 1 },
];

function defaultSettings(): Settings {
  return {
    id: 'local-settings',
    theme: 'system',
    default_reminder: 10,
    week_start: 'Monday',
    default_duration: 30,
    notification_sound: 'default',
    language: 'en',
    timezone: 'UTC',
    sync_version: 1,
  };
}

function emptyDb(): LocalDb {
  return {
    categories: SYSTEM_CATEGORIES.map((c) => ({ ...c })),
    templates: [],
    occurrences: [],
    settings: defaultSettings(),
    streaks: { current_streak: 0, longest_streak: 0, last_completed_date: null },
    timers: [],
  };
}

async function loadDb(): Promise<LocalDb> {
  const raw = await storage.getItem(STORE_KEY);
  if (!raw) {
    const db = emptyDb();
    await saveDb(db);
    return db;
  }
  try {
    const parsed = JSON.parse(raw) as LocalDb;
    if (!parsed.categories?.length) parsed.categories = SYSTEM_CATEGORIES.map((c) => ({ ...c }));
    if (!parsed.settings) parsed.settings = defaultSettings();
    if (!parsed.streaks) parsed.streaks = { current_streak: 0, longest_streak: 0, last_completed_date: null };
    if (!parsed.templates) parsed.templates = [];
    if (!parsed.occurrences) parsed.occurrences = [];
    if (!parsed.timers) parsed.timers = [];
    return parsed;
  } catch {
    const db = emptyDb();
    await saveDb(db);
    return db;
  }
}

async function saveDb(db: LocalDb): Promise<void> {
  await storage.setItem(STORE_KEY, JSON.stringify(db));
}

function dayOfWeek(date: string): number {
  return new Date(`${date}T00:00:00`).getDay();
}

function abbreviatedDay(date: string): string {
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayOfWeek(date)];
}

function shouldGenerate(template: TaskTemplate, date: string, db: LocalDb): boolean {
  if (template.start_date > date || (template.due_date && template.due_date < date)) return false;
  if (template.recurrence_type === 'DAILY' ||
    (template.recurrence_type === 'RECURRING' && template.recurrence_interval === 'DAILY')) return true;
  if (template.recurrence_type === 'RECURRING' && template.recurrence_interval === 'WEEKLY') {
    return dayOfWeek(template.start_date) === dayOfWeek(date);
  }
  if (template.recurrence_type === 'RECURRING' && template.recurrence_interval === 'MONTHLY') {
    return new Date(`${template.start_date}T00:00:00`).getDate() === new Date(`${date}T00:00:00`).getDate();
  }
  if (template.recurrence_type === 'RECURRING' && template.recurrence_interval === 'YEARLY') {
    const s = new Date(`${template.start_date}T00:00:00`);
    const c = new Date(`${date}T00:00:00`);
    return s.getMonth() === c.getMonth() && s.getDate() === c.getDate();
  }
  if (template.recurrence_type !== 'CUSTOM') return false;
  if (template.custom_days) {
    const days = template.custom_days.split(',').map((d) => d.trim().toLowerCase());
    if (days.includes(abbreviatedDay(date).toLowerCase())) return true;
  }
  if (template.due_date) {
    return !db.occurrences.some(
      (o) => o.task_template_id === template.id && o.status === 'COMPLETED' && !o.deleted_at,
    );
  }
  return false;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

// ── Categories ───────────────────────────────────────────────────────────────

export async function localGetCategories(): Promise<Category[]> {
  const db = await loadDb();
  return db.categories.filter((c) => !c.deleted_at);
}

export async function localCreateCategory(data: Pick<Category, 'name' | 'icon_path' | 'color_hex'>): Promise<Category> {
  const db = await loadDb();
  const row: Category = {
    id: uid(),
    owner_id: null,
    name: data.name,
    icon_path: data.icon_path,
    is_system: false,
    color_hex: data.color_hex,
    created_at: nowIso(),
    updated_at: nowIso(),
    deleted_at: null,
    sync_version: 1,
  };
  db.categories.push(row);
  await saveDb(db);
  return row;
}

export async function localUpdateCategory(
  id: string,
  data: Partial<Pick<Category, 'name' | 'icon_path' | 'color_hex'>>,
): Promise<Category> {
  const db = await loadDb();
  const idx = db.categories.findIndex((c) => c.id === id && !c.is_system && !c.deleted_at);
  if (idx < 0) throw new Error('Category not found.');
  db.categories[idx] = { ...db.categories[idx]!, ...data, updated_at: nowIso() };
  await saveDb(db);
  return db.categories[idx]!;
}

export async function localDeleteCategory(id: string): Promise<void> {
  const db = await loadDb();
  const cat = db.categories.find((c) => c.id === id);
  if (!cat || cat.is_system) throw new Error('Cannot delete this category.');
  cat.deleted_at = nowIso();
  cat.updated_at = nowIso();
  await saveDb(db);
}

// ── Templates ────────────────────────────────────────────────────────────────

export async function localGetTaskTemplates(): Promise<TaskTemplate[]> {
  const db = await loadDb();
  return db.templates.filter((t) => !t.deleted_at);
}

export async function localCreateTaskTemplate(data: {
  category_id: string;
  title: string;
  description?: string | null;
  start_date: string;
  due_date?: string | null;
  start_time: string;
  time_to_complete: number;
  reminder_enabled: boolean;
  recurrence_type: RecurrenceType;
  recurrence_interval?: RecurrenceInterval | null;
  custom_days?: string | null;
}): Promise<TaskTemplate> {
  const db = await loadDb();
  const row: TaskTemplate = {
    id: uid(),
    owner_id: null,
    category_id: data.category_id,
    title: data.title,
    description: data.description ?? null,
    start_date: data.start_date,
    due_date: data.due_date ?? null,
    start_time: data.start_time,
    time_to_complete: data.time_to_complete,
    reminder_enabled: data.reminder_enabled,
    recurrence_type: data.recurrence_type,
    recurrence_interval: data.recurrence_interval ?? null,
    custom_days: data.custom_days ?? null,
    created_at: nowIso(),
    updated_at: nowIso(),
    deleted_at: null,
    sync_version: 1,
  };
  db.templates.push(row);
  await saveDb(db);
  return row;
}

export async function localUpdateTaskTemplate(id: string, data: Partial<TaskTemplate>): Promise<TaskTemplate> {
  const db = await loadDb();
  const idx = db.templates.findIndex((t) => t.id === id && !t.deleted_at);
  if (idx < 0) throw new Error('Template not found.');
  db.templates[idx] = { ...db.templates[idx]!, ...data, id, updated_at: nowIso() };
  await saveDb(db);
  return db.templates[idx]!;
}

export async function localDeleteTaskTemplate(id: string): Promise<void> {
  const db = await loadDb();
  const t = db.templates.find((x) => x.id === id);
  if (!t) return;
  t.deleted_at = nowIso();
  t.updated_at = nowIso();
  await saveDb(db);
}

export async function localGenerateForRange(startDate: string, endDate: string): Promise<{ generated: number }> {
  const db = await loadDb();
  let generated = 0;
  const cursor = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  while (cursor <= end) {
    const date = format(cursor, 'yyyy-MM-dd');
    for (const template of db.templates.filter((t) => !t.deleted_at)) {
      if (!shouldGenerate(template, date, db)) continue;
      const exists = db.occurrences.some((o) => o.task_template_id === template.id && o.date === date);
      if (exists) continue;
      db.occurrences.push({
        id: uid(),
        owner_id: null,
        task_template_id: template.id,
        date,
        title: template.title,
        description: template.description,
        category_id: template.category_id,
        start_time: template.start_time,
        time_to_complete: template.time_to_complete,
        status: 'TODO',
        elapsed_time: 0,
        reminder_enabled: template.reminder_enabled,
        is_detached: false,
        created_at: nowIso(),
        updated_at: nowIso(),
        deleted_at: null,
        sync_version: 1,
      });
      generated += 1;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  await saveDb(db);
  return { generated };
}

export async function localGenerateToday(): Promise<{ generated: number }> {
  const today = format(new Date(), 'yyyy-MM-dd');
  return localGenerateForRange(today, today);
}

// ── Occurrences ──────────────────────────────────────────────────────────────

export async function localGetTaskOccurrences(params: GetOccurrencesParams = {}): Promise<TaskOccurrence[]> {
  const db = await loadDb();
  return db.occurrences
    .filter((o) => !o.deleted_at)
    .filter((o) => {
      if (params.date) return o.date === params.date;
      if (params.start_date && o.date < params.start_date) return false;
      if (params.end_date && o.date > params.end_date) return false;
      if (params.status) return o.status === params.status;
      if (params.category_id) return o.category_id === params.category_id;
      return true;
    })
    .sort((a, b) => (a.date + a.start_time).localeCompare(b.date + b.start_time));
}

export async function localCreateTaskOccurrence(data: {
  category_id: string;
  title: string;
  description?: string | null;
  date: string;
  start_time: string;
  time_to_complete: number;
  reminder_enabled: boolean;
  status?: TaskStatus;
  elapsed_time?: number;
  task_template_id?: string | null;
}): Promise<TaskOccurrence> {
  const db = await loadDb();
  const row: TaskOccurrence = {
    id: uid(),
    owner_id: null,
    task_template_id: data.task_template_id ?? null,
    date: data.date,
    title: data.title,
    description: data.description ?? null,
    category_id: data.category_id,
    start_time: data.start_time,
    time_to_complete: data.time_to_complete,
    status: data.status ?? 'TODO',
    elapsed_time: data.elapsed_time ?? 0,
    reminder_enabled: data.reminder_enabled,
    is_detached: false,
    created_at: nowIso(),
    updated_at: nowIso(),
    deleted_at: null,
    sync_version: 1,
  };
  db.occurrences.push(row);
  await saveDb(db);
  return row;
}

export async function localUpdateTaskOccurrence(id: string, data: Partial<TaskOccurrence> & { decouple?: boolean }): Promise<TaskOccurrence> {
  const db = await loadDb();
  const idx = db.occurrences.findIndex((o) => o.id === id && !o.deleted_at);
  if (idx < 0) throw new Error('Task not found.');
  const updates = { ...data };
  delete (updates as { decouple?: boolean }).decouple;
  if (data.decouple) (updates as TaskOccurrence).is_detached = true;
  const oldStatus = db.occurrences[idx]!.status;
  db.occurrences[idx] = { ...db.occurrences[idx]!, ...updates, id, updated_at: nowIso() };
  if (updates.status === 'COMPLETED' && oldStatus !== 'COMPLETED') {
    const today = format(new Date(), 'yyyy-MM-dd');
    const yesterday = format(new Date(Date.now() - 86400000), 'yyyy-MM-dd');
    if (db.streaks.last_completed_date !== today) {
      const current = db.streaks.last_completed_date === yesterday ? db.streaks.current_streak + 1 : 1;
      db.streaks = {
        current_streak: current,
        longest_streak: Math.max(current, db.streaks.longest_streak),
        last_completed_date: today,
      };
    }
  }
  await saveDb(db);
  return db.occurrences[idx]!;
}

export async function localDeleteTaskOccurrence(
  id: string,
  scope?: DeleteScope,
  date_range?: { start: string; end: string },
): Promise<void> {
  const db = await loadDb();
  const occ = db.occurrences.find((o) => o.id === id);
  if (!occ) return;
  const templateId = occ.task_template_id;
  if (scope === 'SINGLE' || (!scope && !templateId)) {
    occ.deleted_at = nowIso();
    occ.updated_at = nowIso();
  } else if (scope === 'RANGE' && templateId) {
    for (const o of db.occurrences) {
      if (o.task_template_id !== templateId || o.deleted_at) continue;
      if (date_range?.start && o.date < date_range.start) continue;
      if (date_range?.end && o.date > date_range.end) continue;
      o.deleted_at = nowIso();
      o.updated_at = nowIso();
    }
  } else if (scope === 'ALL_RECURRING' && templateId) {
    for (const o of db.occurrences) {
      if (o.task_template_id === templateId && !o.deleted_at) {
        o.deleted_at = nowIso();
        o.updated_at = nowIso();
      }
    }
    const t = db.templates.find((x) => x.id === templateId);
    if (t) {
      t.deleted_at = nowIso();
      t.updated_at = nowIso();
    }
  }
  await saveDb(db);
}

export async function localCheckConflict(data: {
  date: string;
  start_time: string;
  time_to_complete: number;
  exclude_id?: string;
}): Promise<ConflictCheck> {
  const rows = await localGetTaskOccurrences({ date: data.date });
  const newStart = timeToMinutes(data.start_time);
  const newEnd = newStart + data.time_to_complete;
  const conflicting = rows.filter((row) => {
    if (row.status === 'COMPLETED') return false;
    if (data.exclude_id && row.id === data.exclude_id) return false;
    const existingStart = timeToMinutes(row.start_time);
    const existingEnd = existingStart + row.time_to_complete;
    return newStart < existingEnd && newEnd > existingStart;
  });
  return {
    has_conflict: conflicting.length > 0,
    conflicting_tasks: conflicting.map((row) => {
      const end = timeToMinutes(row.start_time) + row.time_to_complete;
      const hh = String(Math.floor(end / 60)).padStart(2, '0');
      const mm = String(end % 60).padStart(2, '0');
      return { id: row.id, title: row.title, start_time: row.start_time, end_time: `${hh}:${mm}:00` };
    }),
  };
}

// ── Timer / settings / dashboard ─────────────────────────────────────────────

export async function localPlayTimer(task_occurrence_id: string): Promise<TimerSession> {
  const db = await loadDb();
  for (const t of db.timers.filter((x) => x.is_active)) {
    t.is_active = false;
    t.end_time = nowIso();
    const start = new Date(t.start_time).getTime();
    const elapsed = Math.max(0, Math.floor((Date.now() - start) / 1000));
    const occ = db.occurrences.find((o) => o.id === t.task_occurrence_id);
    if (occ) occ.elapsed_time += elapsed;
  }
  const session: TimerSession = {
    id: uid(),
    task_occurrence_id,
    start_time: nowIso(),
    end_time: null,
    is_active: true,
  };
  db.timers.push(session);
  const occ = db.occurrences.find((o) => o.id === task_occurrence_id);
  if (occ) occ.status = 'IN_PROGRESS';
  await saveDb(db);
  return session;
}

export async function localPauseTimer(): Promise<TimerSession> {
  const db = await loadDb();
  const active = db.timers.find((t) => t.is_active);
  if (!active) throw new Error('No active timer session to pause.');
  const start = new Date(active.start_time).getTime();
  const elapsed = Math.max(0, Math.floor((Date.now() - start) / 1000));
  active.is_active = false;
  active.end_time = nowIso();
  const occ = db.occurrences.find((o) => o.id === active.task_occurrence_id);
  if (occ) occ.elapsed_time += elapsed;
  await saveDb(db);
  return active;
}

export async function localGetActiveTimer(): Promise<{ session: TimerSession; baseElapsed: number } | null> {
  const db = await loadDb();
  const session = db.timers.find((t) => t.is_active) ?? null;
  if (!session) return null;
  const occ = db.occurrences.find((o) => o.id === session.task_occurrence_id);
  return { session, baseElapsed: occ?.elapsed_time ?? 0 };
}

export async function localGetSettings(): Promise<Settings> {
  return (await loadDb()).settings;
}

export async function localUpdateSettings(data: Partial<Settings>): Promise<Settings> {
  const db = await loadDb();
  db.settings = { ...db.settings, ...data, id: db.settings.id };
  await saveDb(db);
  return db.settings;
}

export async function localGetDashboardStreaks(): Promise<DashboardStreaks> {
  return (await loadDb()).streaks;
}

export async function localGetTimeSpent(start_date: string, end_date: string): Promise<TimeSpentDataPoint[]> {
  const rows = await localGetTaskOccurrences({ start_date, end_date });
  const grouped = new Map<string, number>();
  for (const row of rows) grouped.set(row.date, (grouped.get(row.date) ?? 0) + row.elapsed_time);
  return [...grouped.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, total_seconds_spent]) => ({ date, total_seconds_spent }));
}

export async function localGetCompletionRate(start_date: string, end_date: string): Promise<CompletionRateDataPoint[]> {
  const rows = await localGetTaskOccurrences({ start_date, end_date });
  const grouped = new Map<string, { total: number; completed: number }>();
  for (const row of rows) {
    const cur = grouped.get(row.date) ?? { total: 0, completed: 0 };
    cur.total += 1;
    if (row.status === 'COMPLETED') cur.completed += 1;
    grouped.set(row.date, cur);
  }
  return [...grouped.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, stats]) => ({
      date,
      completed_count: stats.completed,
      total_count: stats.total,
      completion_rate: stats.total > 0 ? Math.round((stats.completed / stats.total) * 10000) / 10000 : 0,
    }));
}
