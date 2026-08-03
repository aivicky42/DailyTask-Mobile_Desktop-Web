import { format } from 'date-fns';
import { supabase } from './supabase';
import { getSyncEnabled, setLastSyncAt } from './appConfig';
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
  TaskStatus,
  RecurrenceType,
  RecurrenceInterval,
} from '../types';

async function requireUserId(): Promise<string> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('Please sign in to enable sync.');
  return data.user.id;
}

/**
 * Cloud only when the user opts into Sync and is signed in.
 * Otherwise the app uses browser local storage (no API server needed).
 */
export async function isCloudMode(): Promise<boolean> {
  if (!supabase || !(await getSyncEnabled())) return false;
  const { data } = await supabase.auth.getUser();
  return Boolean(data.user);
}

function nowIso(): string {
  return new Date().toISOString();
}

function dayOfWeek(date: string): number {
  return new Date(`${date}T00:00:00`).getDay();
}

function dayOfMonth(date: string): number {
  return new Date(`${date}T00:00:00`).getDate();
}

function abbreviatedDay(date: string): string {
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayOfWeek(date)];
}

async function shouldGenerateOccurrence(template: TaskTemplate, date: string, ownerId: string): Promise<boolean> {
  if (template.start_date > date || (template.due_date && template.due_date < date)) return false;

  if (template.recurrence_type === 'DAILY' ||
    (template.recurrence_type === 'RECURRING' && template.recurrence_interval === 'DAILY')) return true;

  if (template.recurrence_type === 'RECURRING' && template.recurrence_interval === 'WEEKLY') {
    return dayOfWeek(template.start_date) === dayOfWeek(date);
  }

  if (template.recurrence_type === 'RECURRING' && template.recurrence_interval === 'MONTHLY') {
    return dayOfMonth(template.start_date) === dayOfMonth(date);
  }

  if (template.recurrence_type === 'RECURRING' && template.recurrence_interval === 'YEARLY') {
    const start = new Date(`${template.start_date}T00:00:00`);
    const current = new Date(`${date}T00:00:00`);
    return start.getMonth() === current.getMonth() && start.getDate() === current.getDate();
  }

  if (template.recurrence_type !== 'CUSTOM') return false;

  if (template.custom_days) {
    const customDays = template.custom_days.split(',').map((value) => value.trim().toLowerCase());
    const day = abbreviatedDay(date).toLowerCase();
    const dayUpper = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][dayOfWeek(date)];
    if (customDays.includes(day) || customDays.includes(dayUpper)) return true;
  }

  if (template.due_date) {
    const { data: completedOccurrence, error } = await supabase!
      .from('task_occurrences')
      .select('id')
      .eq('owner_id', ownerId)
      .eq('task_template_id', template.id)
      .eq('status', 'COMPLETED')
      .is('deleted_at', null)
      .maybeSingle();
    if (error) throw error;
    return !completedOccurrence;
  }

  return false;
}
async function getOrCreateSettings(ownerId: string): Promise<Settings> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data: existing } = await supabase
    .from('settings')
    .select('*')
    .eq('owner_id', ownerId)
    .maybeSingle();

  if (existing) return existing as Settings;

  const { data, error } = await supabase
    .from('settings')
    .insert({ owner_id: ownerId, theme: 'system', default_reminder: 10, week_start: 'Monday', default_duration: 30, notification_sound: 'default', language: 'en', timezone: 'UTC' })
    .select('*')
    .single();
  if (error) throw error;
  return data as Settings;
}

async function getOrCreateStreak(ownerId: string): Promise<any> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data: existing } = await supabase
    .from('streaks')
    .select('*')
    .eq('owner_id', ownerId)
    .maybeSingle();

  if (existing) return existing;
  const { data, error } = await supabase
    .from('streaks')
    .insert({ owner_id: ownerId, current_streak: 0, longest_streak: 0, last_completed_date: null })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

async function bumpStreakIfNeeded(ownerId: string): Promise<void> {
  const today = format(new Date(), 'yyyy-MM-dd');
  const yesterday = format(new Date(Date.now() - 86400000), 'yyyy-MM-dd');
  const streak = await getOrCreateStreak(ownerId);
  if (streak.last_completed_date === today) return;
  const current = streak.last_completed_date === yesterday ? streak.current_streak + 1 : 1;
  const longest = Math.max(current, streak.longest_streak);
  await supabase!
    .from('streaks')
    .update({ current_streak: current, longest_streak: longest, last_completed_date: today, updated_at: nowIso() })
    .eq('id', streak.id);
}

function rowToConflictTask(row: TaskOccurrence): { id: string; title: string; start_time: string; end_time: string } {
  const [h, m] = row.start_time.split(':').map(Number);
  const end = new Date();
  end.setHours(h || 0, m || 0, 0, 0);
  end.setMinutes(end.getMinutes() + row.time_to_complete);
  return { id: row.id, title: row.title, start_time: row.start_time, end_time: format(end, 'HH:mm:ss') };
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

async function addElapsedTime(taskOccurrenceId: string, ownerId: string, elapsedSeconds: number): Promise<void> {
  const { data: occurrence } = await supabase!
    .from('task_occurrences')
    .select('elapsed_time')
    .eq('id', taskOccurrenceId)
    .eq('owner_id', ownerId)
    .single();
  const currentElapsed = (occurrence as { elapsed_time?: number } | null)?.elapsed_time ?? 0;
  await supabase!
    .from('task_occurrences')
    .update({ elapsed_time: currentElapsed + elapsedSeconds })
    .eq('id', taskOccurrenceId)
    .eq('owner_id', ownerId);
}

async function getOwnedCategories(ownerId: string): Promise<Category[]> {
  const { data, error } = await supabase!
    .from('categories')
    .select('*')
    .or(`is_system.eq.true,owner_id.eq.${ownerId}`)
    .is('deleted_at', null)
    .order('is_system', { ascending: false })
    .order('name', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Category[];
}

export async function cloudGetCategories(): Promise<Category[]> {
  const ownerId = await requireUserId();
  return getOwnedCategories(ownerId);
}

export async function cloudCreateCategory(data: Pick<Category, 'name' | 'icon_path' | 'color_hex'>): Promise<Category> {
  const ownerId = await requireUserId();
  const { data: row, error } = await supabase!
    .from('categories')
    .insert({ ...data, owner_id: ownerId, is_system: false })
    .select('*')
    .single();
  if (error) throw error;
  return row as Category;
}

export async function cloudUpdateCategory(id: string, data: Partial<Pick<Category, 'name' | 'icon_path' | 'color_hex'>>): Promise<Category> {
  const ownerId = await requireUserId();
  const { data: row, error } = await supabase!
    .from('categories')
    .update(data)
    .eq('id', id)
    .eq('owner_id', ownerId)
    .eq('is_system', false)
    .select('*')
    .single();
  if (error) throw error;
  return row as Category;
}

export async function cloudDeleteCategory(id: string): Promise<void> {
  const ownerId = await requireUserId();
  const { error } = await supabase!
    .from('categories')
    .update({ deleted_at: nowIso() })
    .eq('id', id)
    .eq('owner_id', ownerId)
    .eq('is_system', false);
  if (error) throw error;
}

export async function cloudGetTaskTemplates(): Promise<TaskTemplate[]> {
  const ownerId = await requireUserId();
  const { data, error } = await supabase!
    .from('task_templates')
    .select('*')
    .eq('owner_id', ownerId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as TaskTemplate[];
}

export async function cloudCreateTaskTemplate(data: Omit<TaskTemplate, 'id' | 'owner_id' | 'created_at' | 'updated_at' | 'deleted_at' | 'sync_version'>): Promise<TaskTemplate> {
  const ownerId = await requireUserId();
  const { data: row, error } = await supabase!
    .from('task_templates')
    .insert({ ...data, owner_id: ownerId })
    .select('*')
    .single();
  if (error) throw error;
  return row as TaskTemplate;
}

export async function cloudUpdateTaskTemplate(id: string, data: Partial<Omit<TaskTemplate, 'id' | 'owner_id' | 'created_at' | 'updated_at' | 'deleted_at' | 'sync_version'>>): Promise<TaskTemplate> {
  const ownerId = await requireUserId();
  const { data: row, error } = await supabase!
    .from('task_templates')
    .update(data)
    .eq('id', id)
    .eq('owner_id', ownerId)
    .select('*')
    .single();
  if (error) throw error;
  return row as TaskTemplate;
}

export async function cloudDeleteTaskTemplate(id: string): Promise<void> {
  const ownerId = await requireUserId();
  const { error } = await supabase!
    .from('task_templates')
    .update({ deleted_at: nowIso() })
    .eq('id', id)
    .eq('owner_id', ownerId);
  if (error) throw error;
}

async function generateOccurrenceForDate(
  ownerId: string,
  template: TaskTemplate,
  date: string,
): Promise<boolean> {
  if (!(await shouldGenerateOccurrence(template, date, ownerId))) return false;

  // Treat soft-deleted rows as tombstones so SINGLE deletes are not regenerated.
  const { data: existing, error: existingError } = await supabase!
    .from('task_occurrences')
    .select('id')
    .eq('task_template_id', template.id)
    .eq('date', date)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) return false;

  const { error: insertError } = await supabase!.from('task_occurrences').insert({
    owner_id: ownerId,
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
  });
  if (insertError) throw insertError;
  return true;
}

export async function cloudGenerateForRange(startDate: string, endDate: string): Promise<{ generated: number }> {
  const ownerId = await requireUserId();
  const { data: templates, error } = await supabase!
    .from('task_templates')
    .select('*')
    .eq('owner_id', ownerId)
    .is('deleted_at', null)
    .lte('start_date', endDate);
  if (error) throw error;

  let generated = 0;
  const cursor = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  while (cursor <= end) {
    const date = format(cursor, 'yyyy-MM-dd');
    for (const template of (templates ?? []) as TaskTemplate[]) {
      if (await generateOccurrenceForDate(ownerId, template, date)) generated += 1;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return { generated };
}

export async function cloudGenerateToday(): Promise<{ generated: number }> {
  const today = format(new Date(), 'yyyy-MM-dd');
  return cloudGenerateForRange(today, today);
}
export async function cloudGetTaskOccurrences(params: Record<string, string> = {}): Promise<TaskOccurrence[]> {
  const ownerId = await requireUserId();
  let query = supabase!.from('task_occurrences').select('*').eq('owner_id', ownerId).is('deleted_at', null);
  if (params.date) query = query.eq('date', params.date);
  else {
    if (params.start_date) query = query.gte('date', params.start_date);
    if (params.end_date) query = query.lte('date', params.end_date);
  }
  if (params.status) query = query.eq('status', params.status as TaskStatus);
  if (params.category_id) query = query.eq('category_id', params.category_id);
  const { data, error } = await query.order('date', { ascending: true }).order('start_time', { ascending: true });
  if (error) throw error;
  return (data ?? []) as TaskOccurrence[];
}

export async function cloudCreateTaskOccurrence(data: Omit<TaskOccurrence, 'id' | 'owner_id' | 'task_template_id' | 'is_detached' | 'created_at' | 'updated_at' | 'deleted_at' | 'sync_version'> & { task_template_id?: string | null }): Promise<TaskOccurrence> {
  const ownerId = await requireUserId();
  const { data: row, error } = await supabase!
    .from('task_occurrences')
    .insert({ ...data, owner_id: ownerId, task_template_id: data.task_template_id ?? null, is_detached: false })
    .select('*')
    .single();
  if (error) throw error;
  return row as TaskOccurrence;
}

export async function cloudUpdateTaskOccurrence(id: string, data: Partial<Omit<TaskOccurrence, 'id' | 'owner_id' | 'created_at' | 'updated_at' | 'deleted_at' | 'sync_version'>> & { decouple?: boolean }): Promise<TaskOccurrence> {
  const ownerId = await requireUserId();
  const updates: Record<string, unknown> = { ...data };
  delete updates.decouple;
  if (data.decouple) updates.is_detached = true;
  const { data: existing } = await supabase!.from('task_occurrences').select('*').eq('id', id).eq('owner_id', ownerId).maybeSingle();
  if (!existing) throw new Error('Task occurrence not found.');
  const oldStatus = (existing as TaskOccurrence).status;
  const { data: row, error } = await supabase!.from('task_occurrences').update(updates).eq('id', id).eq('owner_id', ownerId).select('*').single();
  if (error) throw error;
  if (updates.status === 'COMPLETED' && oldStatus !== 'COMPLETED') {
    await bumpStreakIfNeeded(ownerId);
  }
  return row as TaskOccurrence;
}

export async function cloudDeleteTaskOccurrence(id: string, scope?: DeleteScope, date_range?: { start: string; end: string }): Promise<void> {
  const ownerId = await requireUserId();
  const { data: occurrence } = await supabase!.from('task_occurrences').select('*').eq('id', id).eq('owner_id', ownerId).maybeSingle();
  if (!occurrence) return;
  const templateId = (occurrence as TaskOccurrence).task_template_id;
  if (scope === 'SINGLE' || (!scope && !templateId)) {
    await supabase!.from('task_occurrences').update({ deleted_at: nowIso() }).eq('id', id).eq('owner_id', ownerId);
    return;
  }
  if (scope === 'RANGE' && templateId) {
    let q = supabase!.from('task_occurrences').update({ deleted_at: nowIso() }).eq('task_template_id', templateId).eq('owner_id', ownerId).is('deleted_at', null);
    if (date_range?.start) q = q.gte('date', date_range.start);
    if (date_range?.end) q = q.lte('date', date_range.end);
    await q;
    return;
  }
  if (scope === 'ALL_RECURRING' && templateId) {
    await supabase!.from('task_occurrences').update({ deleted_at: nowIso() }).eq('task_template_id', templateId).eq('owner_id', ownerId).is('deleted_at', null);
    await supabase!.from('task_templates').update({ deleted_at: nowIso() }).eq('id', templateId).eq('owner_id', ownerId);
  }
}

export async function cloudCheckConflict(data: { date: string; start_time: string; time_to_complete: number; exclude_id?: string; }): Promise<ConflictCheck> {
  const ownerId = await requireUserId();
  const { data: rows, error } = await supabase!
    .from('task_occurrences')
    .select('*')
    .eq('owner_id', ownerId)
    .eq('date', data.date)
    .neq('status', 'COMPLETED')
    .is('deleted_at', null)
    .order('start_time', { ascending: true });
  if (error) throw error;
  const newStart = timeToMinutes(data.start_time);
  const newEnd = newStart + data.time_to_complete;
  const conflicting = ((rows ?? []) as TaskOccurrence[]).filter((row) => {
    if (data.exclude_id && row.id === data.exclude_id) return false;
    const existingStart = timeToMinutes(row.start_time);
    const existingEnd = existingStart + row.time_to_complete;
    return newStart < existingEnd && newEnd > existingStart;
  });
  return {
    has_conflict: conflicting.length > 0,
    conflicting_tasks: conflicting.map(rowToConflictTask),
  };
}

export async function cloudPlayTimer(task_occurrence_id: string): Promise<TimerSession> {
  const ownerId = await requireUserId();
  const { data: activeSessions } = await supabase!.from('timer_sessions').select('*').eq('owner_id', ownerId).eq('is_active', true).is('deleted_at', null);
  if ((activeSessions ?? []).length > 0) {
    const active = activeSessions![0] as TimerSession;
    const start = new Date(active.start_time).getTime();
    const elapsed = Math.max(0, Math.floor((Date.now() - start) / 1000));
    await supabase!.from('timer_sessions').update({ is_active: false, end_time: nowIso() }).eq('id', active.id).eq('owner_id', ownerId);
    await addElapsedTime(active.task_occurrence_id, ownerId, elapsed);
  }
  const { data: row, error } = await supabase!
    .from('timer_sessions')
    .insert({ owner_id: ownerId, task_occurrence_id, start_time: nowIso(), is_active: true })
    .select('*')
    .single();
  if (error) throw error;
  await supabase!.from('task_occurrences').update({ status: 'IN_PROGRESS' }).eq('id', task_occurrence_id).eq('owner_id', ownerId);
  return row as TimerSession;
}

export async function cloudPauseTimer(): Promise<TimerSession> {
  const ownerId = await requireUserId();
  const { data: active } = await supabase!.from('timer_sessions').select('*').eq('owner_id', ownerId).eq('is_active', true).is('deleted_at', null).maybeSingle();
  if (!active) throw new Error('No active timer session to pause.');
  const session = active as TimerSession;
  const start = new Date(session.start_time).getTime();
  const elapsed = Math.max(0, Math.floor((Date.now() - start) / 1000));
  await supabase!.from('timer_sessions').update({ is_active: false, end_time: nowIso() }).eq('id', session.id).eq('owner_id', ownerId);
  await addElapsedTime(session.task_occurrence_id, ownerId, elapsed);
  return { ...session, is_active: false, end_time: nowIso() };
}

export async function cloudGetActiveTimer(): Promise<{ session: TimerSession; baseElapsed: number } | null> {
  const ownerId = await requireUserId();
  const { data: session } = await supabase!.from('timer_sessions').select('*').eq('owner_id', ownerId).eq('is_active', true).is('deleted_at', null).maybeSingle();
  if (!session) return null;
  const { data: occ } = await supabase!.from('task_occurrences').select('elapsed_time').eq('id', (session as TimerSession).task_occurrence_id).eq('owner_id', ownerId).maybeSingle();
  return { session: session as TimerSession, baseElapsed: (occ as any)?.elapsed_time ?? 0 };
}

export async function cloudGetSettings(): Promise<Settings> { return getOrCreateSettings(await requireUserId()); }

export async function cloudUpdateSettings(data: Partial<Settings>): Promise<Settings> {
  const ownerId = await requireUserId();
  const settings = await getOrCreateSettings(ownerId);
  const { data: row, error } = await supabase!.from('settings').update(data).eq('id', settings.id).eq('owner_id', ownerId).select('*').single();
  if (error) throw error;
  return row as Settings;
}

export async function cloudGetDashboardStreaks(): Promise<DashboardStreaks> {
  const streak = await getOrCreateStreak(await requireUserId());
  return { current_streak: streak.current_streak, longest_streak: streak.longest_streak, last_completed_date: streak.last_completed_date };
}

export async function cloudGetTimeSpent(start_date: string, end_date: string): Promise<TimeSpentDataPoint[]> {
  const ownerId = await requireUserId();
  const { data, error } = await supabase!.from('task_occurrences').select('date, elapsed_time').eq('owner_id', ownerId).is('deleted_at', null).gte('date', start_date).lte('date', end_date);
  if (error) throw error;
  const grouped = new Map<string, number>();
  for (const row of (data ?? []) as Array<{ date: string; elapsed_time: number }>) grouped.set(row.date, (grouped.get(row.date) ?? 0) + row.elapsed_time);
  return [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, total_seconds_spent]) => ({ date, total_seconds_spent }));
}

export async function cloudGetCompletionRate(start_date: string, end_date: string): Promise<CompletionRateDataPoint[]> {
  const ownerId = await requireUserId();
  const { data, error } = await supabase!.from('task_occurrences').select('date, status').eq('owner_id', ownerId).is('deleted_at', null).gte('date', start_date).lte('date', end_date);
  if (error) throw error;
  const grouped = new Map<string, { total: number; completed: number }>();
  for (const row of (data ?? []) as Array<{ date: string; status: TaskStatus }>) {
    const current = grouped.get(row.date) ?? { total: 0, completed: 0 };
    current.total += 1;
    if (row.status === 'COMPLETED') current.completed += 1;
    grouped.set(row.date, current);
  }
  return [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, stats]) => ({
    date,
    completed_count: stats.completed,
    total_count: stats.total,
    completion_rate: stats.total > 0 ? Math.round((stats.completed / stats.total) * 10000) / 10000 : 0,
  }));
}

export async function cloudSyncNow(): Promise<{ synced_at: string }> {
  const synced_at = nowIso();
  await setLastSyncAt(synced_at);
  return { synced_at };
}
