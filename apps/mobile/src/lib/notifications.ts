import Constants from 'expo-constants';

let notificationsModulePromise: Promise<typeof import('expo-notifications') | null> | null = null;

function canUseNotifications() {
  return Constants.appOwnership !== 'expo' && Constants.executionEnvironment !== 'storeClient';
}

export function loadNotificationsModule() {
  if (!canUseNotifications()) {
    return Promise.resolve(null);
  }

  if (!notificationsModulePromise) {
    notificationsModulePromise = import('expo-notifications').catch(() => null);
  }

  return notificationsModulePromise;
}