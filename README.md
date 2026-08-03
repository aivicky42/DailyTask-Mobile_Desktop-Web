# DailyTask

> Track, manage, and alert users about their schedules, deadlines, and active tasks — with unified time-tracking, offline-first resilience, and optional cloud sync.

---

## Project Structure

```
DailyTask/
├── apps/
│   ├── api/        → Node.js + Express + TypeScript REST API (optional / legacy)
│   ├── web/        → React + Vite + TypeScript Web App
│   ├── desktop/    → Electron desktop shell (wraps the web app)
│   └── mobile/     → Expo React Native Mobile App (iOS + Android)
├── packages/
│   └── shared/     → Shared TypeScript types and constants
├── supabase/       → Cloud schema for optional Sync
└── package.json    → Monorepo workspace root
```

---

## Data modes

| Mode | When | Where data lives |
|------|------|------------------|
| **Local (default)** | One device only | Phone / browser / desktop local storage |
| **Sync (optional)** | Web + mobile (or multiple devices) | Supabase cloud — Enable Sync & sign in |

You do **not** need `npm run api` for normal local or Supabase sync use.

---

## Quick Start

### Prerequisites
- Node.js 20+
- npm 10+
- For mobile: Expo Go (same Wi‑Fi as your PC), or an emulator
- For desktop builds: dependencies from `npm install` (includes Electron)

### 1. Install Dependencies

```bash
npm install

# Mobile may still need its own install in some setups
cd apps/mobile && npm install && cd ../..
```

### 2. Environment (Supabase — optional, required for Sync)

Copy examples to real env files (gitignored) and fill in your project values:

```bash
# Web / Desktop (web build)
cp apps/web/.env.example apps/web/.env

# Mobile
cp apps/mobile/.env.example apps/mobile/.env
```

| App | Variables |
|-----|-----------|
| Web / Desktop | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |
| Mobile | `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` |

Apply [`supabase/schema.sql`](supabase/schema.sql) in the Supabase SQL editor once.

`.env.example` files use **placeholders only**. Real keys stay in local `.env` or host secrets (Vercel / EAS).

In Settings → **Enable Sync**, create or sign in with the same email on each device to share cloud data.

### 3. Start the Web App

```bash
npm run web
# → http://localhost:5173
```

### 4. Start the Desktop App (Electron)

Desktop is a **separate** package (`apps/desktop`). It does not change `apps/web` source; it loads the web UI in an Electron window.

```bash
# Dev: starts Vite + Electron together
npm run desktop:dev

# Or two terminals:
npm run web
npm run desktop

# Preview packaged-style (builds web, then opens Electron offline-style)
npm run desktop:preview

# Build installers (.exe / .dmg / AppImage)
npm run desktop:dist
# → output in apps/desktop/release/
```

| Script | Purpose |
|--------|---------|
| `npm run desktop:dev` | Development (hot reload via Vite) |
| `npm run desktop` | Electron only (expects web on `:5173`) |
| `npm run desktop:preview` | Build web + run Electron against `dist` |
| `npm run desktop:dist` | Produce desktop installers |

Credentials for desktop come from the **web** build (`apps/web/.env` or CI env vars) when you build/pack.

### 5. Start the Mobile App

```bash
npm run mobile
# or: cd apps/mobile && npm start
```

- Scan the QR with **Expo Go** (same Wi‑Fi), or press `a` / `i` for emulator  
- Local mode works **without** the API server  
- For Sync, set mobile `.env` and use Settings → Enable Sync  

### 6. Backend API (optional)

```bash
npm run api
# → http://localhost:3000
```

Kept for legacy/API development. Day-to-day web, desktop, and mobile use **local storage** or **Supabase**, not this server.

---

## Apps Overview

### Web App (`apps/web`)

**Pages:** Dashboard, Tasks, Calendar, Settings  

**Features:** dark/light/system theme, conflict detection, recurrence-aware edit/delete, timers, charts, local-first data, optional Supabase Sync  

**Tech:** React 18, Vite 5, Tailwind CSS 3, React Router v6, TanStack Query v5, Recharts, Zustand  

---

### Desktop App (`apps/desktop`)

Electron shell around the web app — same UI and local/sync behavior, as a native-feeling desktop window.

- **Dev:** loads `http://localhost:5173`  
- **Preview / packaged:** serves the built `apps/web/dist` locally (usable offline after install)  
- **Separate from web:** no Electron code inside `apps/web`  

**Tech:** Electron, electron-builder  

---

### Mobile App (`apps/mobile`)

**Screens:** Dashboard, Tasks, Calendar, Settings  

**Features:** bottom tabs, task modals, live timer, conflict/recurrence flows, notifications, local-first storage, optional Supabase Sync  

**Tech:** Expo, React Navigation v6, TanStack Query, Zustand + AsyncStorage, Supabase JS  

---

### Backend API (`apps/api`) — optional

Express + SQLite API used historically for shared server mode. Not required for local-only or Supabase Sync workflows.

**Tech:** Express 4, TypeScript 5, better-sqlite3, node-cron  

---

## Architecture Principles

### 1. Separation of Template & Occurrence
Tasks are stored as `task_templates` (recurrence rules) and `task_occurrences` (daily instances). Editing “current day only” can detach an occurrence from its template.

### 2. Single Active Focus Constraint
Only one timer may run at a time; starting a new timer pauses the previous one and accumulates elapsed time.

### 3. Schedule Conflict Prevention
Before save, the app checks overlapping time blocks on the same date and offers Override or Reschedule.

### 4. Local-first & optional Sync
- Default: data stays on the device (web/desktop browser storage, mobile local store).  
- Sync: same Supabase account across devices.  
- Timer/session state is persisted so a crash/restart can restore an active timer.

---

## Database Schema (cloud / API)

```
categories          → Task groupings (system + custom)
task_templates      → Master recurring task definitions
task_occurrences    → Daily task instances
timer_sessions      → Per-session tracking logs
reminders           → Scheduled notification alarms
settings            → User preferences
streaks             → Gamification data
```

Soft-delete (`deleted_at`), `sync_version`, and `owner_id` support sync and multi-device ownership under Supabase RLS.

---

## Environment Variables

### Web / Desktop

`apps/web/.env` (from `.env.example`):

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Mobile

`apps/mobile/.env` (from `.env.example`):

```env
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Deploy hosts
- **Vercel (web):** set the `VITE_*` variables in the project env UI  
- **EAS (mobile):** set the `EXPO_PUBLIC_*` variables as EAS secrets / env  
- **Desktop pack:** ensure web env is present when running `desktop:dist`  

Never commit real `.env` files. Keep secrets in local `.env` or host dashboards only.

---

## Development Notes

- Local-only use needs no API and no Sync.  
- Sync requires Supabase schema + env vars + Enable Sync sign-in.  
- Desktop and web share one UI codebase; ship desktop via Electron when you want an offline-friendly PC installer.  
- Mobile production builds use EAS (`eas build`), not Expo Go.
