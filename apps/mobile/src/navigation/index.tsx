import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import DashboardScreen from '../screens/DashboardScreen';
import TasksScreen from '../screens/TasksScreen';
import CalendarScreen from '../screens/CalendarScreen';
import SettingsScreen from '../screens/SettingsScreen';
import TimerBanner from '../components/TimerBanner';

import { MainTabParamList, RootStackParamList } from '../types';
import { COLORS } from '../constants/colors';
import { useAppTheme } from '../hooks/useAppTheme';

// ─── Tab Icons (drawn with primitives) ───────────────────────────────────────

function TabIcon({
  name,
  color,
  size,
}: {
  name: 'dashboard' | 'tasks' | 'calendar' | 'settings';
  color: string;
  size: number;
}) {
  const s = size;
  const style = { width: s, height: s, alignItems: 'center' as const, justifyContent: 'center' as const };

  const icons: Record<string, string> = {
    dashboard: '▦',
    tasks: '☑',
    calendar: '📅',
    settings: '⚙',
  };

  return (
    <View style={style}>
      <View style={{ opacity: 1 }}>
        {/* Use text emoji as icon fallback */}
      </View>
    </View>
  );
}

// ─── Navigators ───────────────────────────────────────────────────────────────

const Tab = createBottomTabNavigator<MainTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

function MainTabs() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1 }}>
      <TimerBanner />
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: theme.surface,
            borderTopColor: theme.border,
            borderTopWidth: StyleSheet.hairlineWidth,
            paddingBottom: insets.bottom > 0 ? insets.bottom - 4 : 8,
            paddingTop: 8,
            height: 56 + (insets.bottom > 0 ? insets.bottom - 4 : 8),
          },
          tabBarActiveTintColor: COLORS.primary,
          tabBarInactiveTintColor: theme.textMuted,
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '600',
            marginTop: 2,
          },
        }}
      >
        <Tab.Screen
          name="Dashboard"
          component={DashboardScreen}
          options={{
            tabBarLabel: 'Dashboard',
            tabBarIcon: ({ color, size }) => (
              <TabIconSVG name="dashboard" color={color} size={size} />
            ),
          }}
        />
        <Tab.Screen
          name="Tasks"
          component={TasksScreen}
          options={{
            tabBarLabel: 'Tasks',
            tabBarIcon: ({ color, size }) => (
              <TabIconSVG name="tasks" color={color} size={size} />
            ),
          }}
        />
        <Tab.Screen
          name="Calendar"
          component={CalendarScreen}
          options={{
            tabBarLabel: 'Calendar',
            tabBarIcon: ({ color, size }) => (
              <TabIconSVG name="calendar" color={color} size={size} />
            ),
          }}
        />
        <Tab.Screen
          name="Settings"
          component={SettingsScreen}
          options={{
            tabBarLabel: 'Settings',
            tabBarIcon: ({ color, size }) => (
              <TabIconSVG name="settings" color={color} size={size} />
            ),
          }}
        />
      </Tab.Navigator>
    </View>
  );
}

// Simple SVG-like icons using View composition
function TabIconSVG({
  name,
  color,
  size,
}: {
  name: string;
  color: string;
  size: number;
}) {
  const s = size * 0.85;

  if (name === 'dashboard') {
    return (
      <View style={{ width: s, height: s, flexDirection: 'row', flexWrap: 'wrap', gap: 2 }}>
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={{
              width: s / 2 - 2,
              height: s / 2 - 2,
              backgroundColor: color,
              borderRadius: 2,
            }}
          />
        ))}
      </View>
    );
  }
  if (name === 'tasks') {
    return (
      <View style={{ width: s, height: s, justifyContent: 'center', gap: 3 }}>
        {[0, 1, 2].map((i) => (
          <View
            key={i}
            style={{
              height: 2.5,
              backgroundColor: color,
              borderRadius: 2,
              width: i === 0 ? s * 0.6 : s,
            }}
          />
        ))}
        <View
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: s * 0.4,
            height: s * 0.4,
            borderWidth: 2,
            borderColor: color,
            borderRadius: 3,
            backgroundColor: 'transparent',
          }}
        />
      </View>
    );
  }
  if (name === 'calendar') {
    return (
      <View
        style={{
          width: s,
          height: s,
          borderWidth: 2,
          borderColor: color,
          borderRadius: 4,
          overflow: 'hidden',
        }}
      >
        <View style={{ height: s * 0.3, backgroundColor: color }} />
        <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', padding: 2, gap: 1 }}>
          {Array.from({ length: 9 }).map((_, i) => (
            <View
              key={i}
              style={{
                width: (s - 10) / 3,
                height: (s * 0.7 - 8) / 3,
                backgroundColor: color,
                borderRadius: 1,
                opacity: 0.5,
              }}
            />
          ))}
        </View>
      </View>
    );
  }
  if (name === 'settings') {
    return (
      <View
        style={{
          width: s,
          height: s,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <View
          style={{
            width: s * 0.55,
            height: s * 0.55,
            borderWidth: 2.5,
            borderColor: color,
            borderRadius: s * 0.275,
          }}
        />
        {[0, 60, 120, 180, 240, 300].map((deg) => (
          <View
            key={deg}
            style={{
              position: 'absolute',
              width: 3,
              height: s * 0.2,
              backgroundColor: color,
              borderRadius: 2,
              transform: [
                { translateY: -s * 0.35 },
                { rotate: `${deg}deg` },
                { translateY: s * 0.35 },
              ],
            }}
          />
        ))}
      </View>
    );
  }
  return <View style={{ width: s, height: s, backgroundColor: color, borderRadius: 4 }} />;
}

export default function RootNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={MainTabs} />
    </Stack.Navigator>
  );
}
