import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const API_BASE_URL_KEY = 'dailytask.apiBaseUrl';
const LAST_SYNC_AT_KEY = 'dailytask.lastSyncAt';
const SYNC_ENABLED_KEY = 'dailytask.syncEnabled';

function detectDefaultApiBaseUrl(): string {
  // Expo Go / dev client exposes the machine host used for Metro bundling.
  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants as { debuggerHost?: string }).debuggerHost ??
    null;
  const host = hostUri?.split(':')[0];

  if (host && host !== 'localhost' && host !== '127.0.0.1') {
    return `http://${host}:3000/api/v1`;
  }

  // Android emulator maps the host loopback to 10.0.2.2
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3000/api/v1';
  }

  return 'http://localhost:3000/api/v1';
}

const DEFAULT_API_BASE_URL = detectDefaultApiBaseUrl();

export async function getApiBaseUrl(): Promise<string> {
  return (await AsyncStorage.getItem(API_BASE_URL_KEY)) ?? DEFAULT_API_BASE_URL;
}

export async function setApiBaseUrl(url: string): Promise<void> {
  await AsyncStorage.setItem(API_BASE_URL_KEY, url.trim());
}

export async function getLastSyncAt(): Promise<string | null> {
  return AsyncStorage.getItem(LAST_SYNC_AT_KEY);
}

export async function setLastSyncAt(timestamp: string): Promise<void> {
  await AsyncStorage.setItem(LAST_SYNC_AT_KEY, timestamp);
}

export async function getSyncEnabled(): Promise<boolean> {
  return (await AsyncStorage.getItem(SYNC_ENABLED_KEY)) === 'true';
}

export async function setSyncEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(SYNC_ENABLED_KEY, enabled ? 'true' : 'false');
}
