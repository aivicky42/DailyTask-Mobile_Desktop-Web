# DailyTask Mobile App

Expo SDK 51 · React Native · TypeScript 5

## Prerequisites

- Node.js ≥ 18
- [Expo CLI](https://docs.expo.dev/get-started/installation/): `npm install -g expo-cli`
- iOS Simulator (macOS only) or Android Emulator / physical device with Expo Go

## Setup

```bash
cd apps/mobile
npm install
```

## Running

```bash
# Start dev server
npm start

# Open on Android emulator
npm run android

# Open on iOS simulator
npm run ios

# Open in browser (limited support)
npm run web
```

## Backend

The app connects to the REST API at `http://localhost:3000/api/v1`.
Make sure the API server is running before starting the app.

For a physical device or production, update `BASE_URL` in `src/api/client.ts`.

## Architecture

```
App.tsx                     Root: QueryClient + Gesture + SafeArea + Navigation
src/
  types/index.ts            All shared TypeScript types
  api/client.ts             All typed API functions (fetch-based)
  store/timerStore.ts       Zustand timer state (AsyncStorage persisted)
  hooks/
    useTimer.ts             1-second interval, play/pause API bridge
    useAppTheme.ts          Light/dark color tokens
  lib/utils.ts              formatTime, formatDate, toDateString helpers
  constants/colors.ts       COLORS, DARK_THEME, LIGHT_THEME
  navigation/index.tsx      Bottom tabs + Stack
  screens/
    DashboardScreen.tsx     Streak, today's tasks, analytics charts
    TasksScreen.tsx         Date navigation, search, category filter, status tabs
    CalendarScreen.tsx      Monthly grid + day tasks
    SettingsScreen.tsx      Theme, defaults, categories
  components/
    TaskCard.tsx            Task item with timer, actions
    TaskModal.tsx           Add/edit bottom sheet (recurrence, conflict check)
    ConflictDialog.tsx      Time conflict alert
    RecurrencePrompt.tsx    Edit/delete scope selector
    TimerBanner.tsx         Active timer overlay
    CategoryBadge.tsx       Colored dot + name pill
    CategoryManager.tsx     CRUD for categories + color/emoji picker
    Charts.tsx              Time spent (bar) + completion rate (line) charts
    CalendarGrid.tsx        7-col monthly calendar with task dots
    StreakCard.tsx          Current streak + longest + motivational message
```

## Key Dependencies

| Package | Purpose |
|---|---|
| `expo-notifications` | Local push notifications with scheduling |
| `expo-sqlite` | Local SQLite (available for offline cache if needed) |
| `@react-native-async-storage/async-storage` | Timer crash-resilient persistence |
| `react-native-gifted-charts` | Bar + line charts |
| `@tanstack/react-query` | Server state, caching, background refetch |
| `zustand` | Client timer state |
| `date-fns` | All date manipulation |
| `@react-native-community/datetimepicker` | Native date/time picker |
