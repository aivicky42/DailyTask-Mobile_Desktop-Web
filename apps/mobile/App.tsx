import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';

import RootNavigator from './src/navigation';
import { useTimerStore } from './src/store/timerStore';
import { getActiveTimer } from './src/api/client';

// ─── Query Client ─────────────────────────────────────────────────────────────

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000 * 60 * 2,    // 2 minutes
      gcTime: 1000 * 60 * 10,       // 10 minutes
    },
    mutations: {
      retry: 1,
    },
  },
});

// ─── Notification Handler ─────────────────────────────────────────────────────

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// ─── Navigation Theme ─────────────────────────────────────────────────────────

const NAV_LIGHT_THEME = {
  dark: false,
  colors: {
    primary: '#6366F1',
    background: '#F5F5F5',
    card: '#FFFFFF',
    text: '#111827',
    border: '#E5E7EB',
    notification: '#6366F1',
  },
};

const NAV_DARK_THEME = {
  dark: true,
  colors: {
    primary: '#6366F1',
    background: '#0D0D0D',
    card: '#1A1A1A',
    text: '#F9FAFB',
    border: '#2D2D2D',
    notification: '#6366F1',
  },
};

// ─── App Inner (needs hooks, so extracted from the root) ──────────────────────

function AppInner() {
  const colorScheme = useColorScheme();
  const { startTimer } = useTimerStore();

  useEffect(() => {
    // 1. Request notification permissions
    (async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        console.warn('[Notifications] Permission not granted.');
      }
    })();

    // 2. Restore active timer from backend on cold start
    (async () => {
      try {
        const activeTimer = await getActiveTimer();
        if (activeTimer?.is_active) {
          startTimer(
            activeTimer.id,
            activeTimer.task_occurrence_id,
            activeTimer.start_time,
            0
          );
        }
      } catch {
        // No active timer or network error — skip silently
      }
    })();

    // 3. Handle notification tap → navigate to task
    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const taskId = response.notification.request.content.data?.taskId as string | undefined;
      if (taskId) {
        // In a full implementation, use a navigation ref here to deep-link to the task
        console.log('[Notifications] Tapped notification for taskId:', taskId);
      }
    });

    // 4. Handle foreground notifications
    const receivedSub = Notifications.addNotificationReceivedListener((notification) => {
      console.log('[Notifications] Received in foreground:', notification.request.content.title);
    });

    return () => {
      responseSub.remove();
      receivedSub.remove();
    };
  }, []);

  const navTheme = colorScheme === 'dark' ? NAV_DARK_THEME : NAV_LIGHT_THEME;

  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      <RootNavigator />
    </NavigationContainer>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AppInner />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
