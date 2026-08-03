import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';

import RootNavigator from './src/navigation';
import { useTimerStore } from './src/store/timerStore';
import { getActiveTimer } from './src/api/client';
import { loadNotificationsModule } from './src/lib/notifications';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000 * 60 * 2,
      gcTime: 1000 * 60 * 10,
    },
    mutations: {
      retry: 1,
    },
  },
});

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

function AppInner() {
  const colorScheme = useColorScheme();
  const { startTimer } = useTimerStore();

  useEffect(() => {
    (async () => {
      try {
        const Notifications = await loadNotificationsModule();

        if (Notifications) {
          Notifications.setNotificationHandler({
            handleNotification: async () => ({
              shouldShowAlert: true,
              shouldShowBanner: true,
              shouldShowList: true,
              shouldPlaySound: true,
              shouldSetBadge: true,
            }),
          });
        }
      } catch {
        // Notifications unavailable in Expo Go
      }

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
        // No active timer — skip
      }
    })();
  }, [startTimer]);

  const navTheme = colorScheme === 'dark' ? NAV_DARK_THEME : NAV_LIGHT_THEME;

  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      <RootNavigator />
    </NavigationContainer>
  );
}

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
