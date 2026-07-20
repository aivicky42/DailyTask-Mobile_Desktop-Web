# DailyTask

> Track, manage, and alert users about their schedules, deadlines, and active tasks — with unified time-tracking, offline-first resilience, and automated conflict resolution.

---

## Project Structure

```
DailyTask_codex/
├── apps/
│   ├── api/        → Node.js + Express + TypeScript REST API (SQLite)
│   ├── web/        → React + Vite + TypeScript Web App
│   └── mobile/     → Expo React Native Mobile App (iOS + Android)
├── packages/
│   └── shared/     → Shared TypeScript types and constants
└── package.json    → Monorepo workspace root
```

---

## Quick Start

### Prerequisites
- Node.js 20+
- npm 10+
- Expo CLI (`npm install -g expo-cli`) — for mobile development

---

### 1. Install Dependencies

```bash
# Install root + API + Web dependencies
npm install

# Install mobile dependencies separately (Expo workflow)
cd apps/mobile && npm install && cd ../..
```

---

### 2. Start the Backend API

```bash
npm run api
# → Server runs at http://localhost:3000
# → SQLite database auto-created at apps/api/dailytask.db
```

The API will:
- Auto-generate the database schema on first run
- Seed the 6 system categories (Work, Personal, Study, Health, Life, Others)
- Create default settings and streaks records
- Schedule the midnight task-rollover job (node-cron)

---

### 3. Start the Web App

```bash
npm run web
# → Dev server at http://localhost:5173
```

---

### 4. Start the Mobile App

```bash
# From the project root
cd apps/mobile
npm start
# → Expo dev server
# → Scan QR code with Expo Go app on your device
# → Press 'a' for Android emulator, 'i' for iOS simulator
```

**Important**: Update the API base URL in `apps/mobile/src/api/client.ts` to match your machine's local IP address (e.g., `http://192.168.1.100:3000/api/v1`) when testing on a physical device.

---

## Apps Overview

### Backend API (`apps/api`)

| Route | Description |
|-------|-------------|
| `GET /api/v1/health` | Server + DB health check |
| `GET/POST /api/v1/categories` | List + create categories |
| `PATCH/DELETE /api/v1/categories/:id` | Update / soft-delete categories |
| `GET/POST /api/v1/task-templates` | List + create recurring templates |
| `PUT /api/v1/task-templates/:id` | Update template |
| `POST /api/v1/task-templates/generate-today` | Manually trigger day rollover |
| `GET/POST /api/v1/task-occurrences` | List (with filters) + create occurrences |
| `PUT /api/v1/task-occurrences/:id` | Update occurrence (supports `decouple`) |
| `DELETE /api/v1/task-occurrences/:id` | Delete with scope (`SINGLE`/`RANGE`/`ALL_RECURRING`) |
| `POST /api/v1/task-occurrences/check-conflict` | Pre-save conflict checker |
| `POST /api/v1/timer-sessions/play` | Start timer (auto-pauses any running session) |
| `POST /api/v1/timer-sessions/pause` | Pause active timer |
| `GET /api/v1/timer-sessions/active` | Restore timer on app startup |
| `GET/PUT /api/v1/settings` | App preferences |
| `GET /api/v1/dashboard/streaks` | Streak statistics |
| `GET /api/v1/dashboard/analytics/time-spent` | Weekly time graph data |
| `GET /api/v1/dashboard/analytics/completion-rate` | Weekly completion rate data |
| `POST /api/v1/sync` | Delta sync protocol |

**Tech**: Express 4, TypeScript 5, better-sqlite3, node-cron

---

### Web App (`apps/web`)

**Pages:**
- **Dashboard** — Streak counter 🔥, active timer banner, today's tasks, time-spent bar chart, completion-rate line chart
- **Tasks** — Date navigation, search, category filter, 3 tabs (To Do / In Progress / Completed), task cards with timer controls
- **Calendar** — Monthly grid with task dot indicators, click-to-see-day task list
- **Settings** — Theme toggle, notification defaults, category management (add/edit/delete with color + emoji)

**Features:**
- Full dark/light/system theme
- Schedule conflict detection with override option
- Recurrence-aware edit/delete (Current Day / Day Range / All)
- Real-time timer display with elapsed + remaining + progress ring
- Optimistic UI updates via TanStack Query

**Tech**: React 18, Vite 5, Tailwind CSS 3, React Router v6, TanStack Query v5, Recharts, Zustand, Lucide React

---

### Mobile App (`apps/mobile`)

**Screens:**
- **Dashboard** — Greeting, streak card, active timer banner, top-5 tasks, analytics charts, pull-to-refresh
- **Tasks** — Date navigation, search bar, category filter chips, 3 tab panels, FAB to add task
- **Calendar** — Monthly grid with task dots, selected-day task list
- **Settings** — Theme selector, defaults, category manager with color picker + emoji/image picker

**Features:**
- Bottom tab navigation
- Task creation/editing via bottom-sheet modal
- Live timer with crash-resilient AsyncStorage persistence
- Conflict detection modal with Override/Reschedule options
- Recurrence-aware edit/delete scope selector
- Local notification scheduling with Snooze (5/10/30 min) support
- Pull-to-refresh on all screens

**Tech**: Expo 51, React Navigation v6, expo-sqlite, expo-notifications, react-native-gifted-charts, Zustand + AsyncStorage

---

## Architecture Principles

### 1. Separation of Template & Occurrence
Tasks are stored as `task_templates` (master definition with recurrence rules) and instantiated as `task_occurrences` (daily instances). Editing "current day only" sets `is_detached = true` on the occurrence, decoupling it from the template without breaking the recurring chain.

### 2. Single Active Focus Constraint
Only one timer session may run at any time. Calling `POST /timer-sessions/play` automatically pauses any currently active session and accumulates its elapsed time before starting the new one.

### 3. Schedule Conflict Prevention
Before any task is saved, the system calculates its time block (`start_time` → `start_time + time_to_complete`) and checks for overlaps with existing tasks on the same date. Conflicts surface an interactive dialog giving the user the option to Override or Reschedule.

### 4. Offline-First & Crash-Resilience
- Timer state is written to persistent storage (SQLite / AsyncStorage) continuously.
- On app launch, `GET /timer-sessions/active` restores any running session, recalculating elapsed time from `now - session_start_time + saved_elapsed`.
- Midnight scheduler (`node-cron` at `0 0 * * *`) generates the new day's tasks automatically.

---

## Database Schema

```
categories          → Task groupings (6 system + custom)
task_templates      → Master recurring task definitions
task_occurrences    → Daily task instances (denormalized from template)
timer_sessions      → Per-session tracking logs (one active at a time)
reminders           → Scheduled notification alarms
settings            → User preferences (one row)
streaks             → Gamification data (one row)
```

All tables include soft-delete (`deleted_at`), optimistic sync (`sync_version`), and `owner_id` for future multi-user support.

---

## Environment Variables

Copy `apps/api/.env.example` to `apps/api/.env`:

```env
PORT=3000
DB_PATH=./dailytask.db
CORS_ORIGIN=http://localhost:5173
NODE_ENV=development
```

---

## Development Notes

- The API uses SQLite for development. Swap `better-sqlite3` for a PostgreSQL driver (e.g., `pg`) and update `db/database.ts` for production cloud deployment.
- The `sync_version` field on every row enables the delta sync protocol: clients send their `last_sync_timestamp` and receive only rows updated since then.
- JWT authentication is stubbed (v1 single-user mode). All `owner_id` values are `null`. Add real auth by populating `owner_id` from JWT claims in `middleware/auth.ts`.
