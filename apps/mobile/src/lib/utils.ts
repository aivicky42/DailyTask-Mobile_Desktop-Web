import { format, parseISO, isToday, isYesterday, isTomorrow } from 'date-fns';

/** Format seconds as a human-readable duration string */
export function formatTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) {
    return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
  }
  if (m > 0) {
    return `${m}m ${String(s).padStart(2, '0')}s`;
  }
  return `${s}s`;
}

/** Format seconds as compact 'HH:MM:SS' */
export function formatTimerCompact(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Format seconds into '1h 30m' short form */
export function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  if (m > 0) return `${m}m`;
  return '< 1m';
}

/** Format a date string for display */
export function formatDate(dateStr: string): string {
  try {
    const date = parseISO(dateStr);
    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    if (isTomorrow(date)) return 'Tomorrow';
    return format(date, 'EEE, MMM d');
  } catch {
    return dateStr;
  }
}

/** Format date for the tasks header */
export function formatDateLong(dateStr: string): string {
  try {
    const date = parseISO(dateStr);
    if (isToday(date)) return `Today · ${format(date, 'MMM d')}`;
    if (isYesterday(date)) return `Yesterday · ${format(date, 'MMM d')}`;
    if (isTomorrow(date)) return `Tomorrow · ${format(date, 'MMM d')}`;
    return format(date, 'EEEE, MMM d');
  } catch {
    return dateStr;
  }
}

/** Parse a 'HH:MM' time string into hours + minutes */
export function parseTimeString(time: string): { hours: number; minutes: number } {
  const [h, m] = time.split(':').map(Number);
  return { hours: h ?? 0, minutes: m ?? 0 };
}

/** Format hours + minutes as 'HH:MM' */
export function toTimeString(hours: number, minutes: number): string {
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/** Format 'HH:MM' as '12:30 PM' */
export function formatTimeDisplay(time: string): string {
  try {
    const [h, m] = time.split(':').map(Number);
    const period = (h ?? 0) >= 12 ? 'PM' : 'AM';
    const hour = (h ?? 0) % 12 || 12;
    return `${hour}:${String(m ?? 0).padStart(2, '0')} ${period}`;
  } catch {
    return time;
  }
}

/** Convert a Date object to 'YYYY-MM-DD' string */
export function toDateString(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

/** Get today's date as 'YYYY-MM-DD' string */
export function today(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

/** Get today's greeting based on hour */
export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/** Clamp a number between min and max */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
