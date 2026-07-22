const API_BASE_URL_KEY = 'dailytask.apiBaseUrl';
const LAST_SYNC_AT_KEY = 'dailytask.lastSyncAt';
const SYNC_ENABLED_KEY = 'dailytask.syncEnabled';

const DEFAULT_API_BASE_URL = '/api/v1';

export async function getApiBaseUrl(): Promise<string> {
  if (typeof window === 'undefined') return DEFAULT_API_BASE_URL;
  return window.localStorage.getItem(API_BASE_URL_KEY) ?? DEFAULT_API_BASE_URL;
}

export async function setApiBaseUrl(url: string): Promise<void> {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(API_BASE_URL_KEY, url.trim());
}

export async function getLastSyncAt(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(LAST_SYNC_AT_KEY);
}

export async function setLastSyncAt(timestamp: string): Promise<void> {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(LAST_SYNC_AT_KEY, timestamp);
}

export async function getSyncEnabled(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(SYNC_ENABLED_KEY) === 'true';
}

export async function setSyncEnabled(enabled: boolean): Promise<void> {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SYNC_ENABLED_KEY, enabled ? 'true' : 'false');
}
