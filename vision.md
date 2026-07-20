# Project Vision: DailyTask

This document outlines the core mission, target audience, architectural philosophy, key features, and success criteria for **DailyTask**, serving as the single source of truth for product direction.

---

## 1. High-Level Identity

* **Project Name**: DailyTask
* **One-Line Mission**: To track, manage, and alert users about their schedules, deadlines, and active tasks using unified time-tracking, offline-first resilience, and automated conflict resolution.
* **Target Users**: Individuals/Solo users seeking high-performance time block management, but architected with multi-user readiness.
* **Platforms**: Interconnected Mobile (iOS/Android) and Web applications, local-first with background cloud database synchronization.

---

## 2. Core Architectural Philosophy & Principles

To distinguish DailyTask from standard checklist applications, it is built on four fundamental principles:

1. **Separation of Template & Occurrence**: Tasks are defined as master structures (`task_templates`) containing recurrence rules, and executed as daily schedules (`task_occurrences`). This allows users to modify single instances without breaking the recurring chain.
2. **Single Active Focus Constraint**: The app promotes deep focus. Only one task timer session may run at any given moment. Starting a new timer automatically pauses any active session, logging its progress historically.
3. **Prevention of Double-Booking**: Time is treated as a finite resource. A task reserves a dedicated time block defined by `Start Time` and `Time-to-Complete`. Overlaps are detected instantly.
4. **Offline-First & Crash-Resistant**: All operations (including timers and custom category creation) function fully offline, with running sessions surviving app closes or restarts.

---

## 3. Core Features (Max 10)

### 3.1 Dashboard (Overview Hub)
An interactive homepage displaying today's streak statistics, immediate timer controls for today's active tasks, and performance graphs comparing active daily time tracking and completion ratios across the week.

### 3.2 Everyday Task Agenda (Task Page)
A tabbed, daily agenda (To Do, In Progress, Completed) featuring a live title/description search bar and instant category filtering, allowing users to select tasks for bulk or single actions.

### 3.3 Task Creation Engine
A unified form to set task details, including title, description, start date, start time, estimated duration (`time_to_complete`), category, local reminders, and recurrence settings.

### 3.4 Automatic Schedule Conflict Prevention
During task creation or modification, the app calculates the task's time block (`Start Time` to `Start Time + Time-to-Complete`). It scans today's agenda and warns the user of overlaps, offering options to **Override** (force-save) or **Reschedule**.

### 3.5 Robust Recurrence Engine
Supports three main recurrence types:
* **Daily**: Repeats every single calendar day.
* **Recurring**: Repeats on standard intervals (Daily, Weekly, Monthly, Yearly).
* **Custom**: Repeats on specified week patterns (e.g., Mon, Wed, Fri), runs as non-recurring, or binds to a final due date.

### 3.6 Persistent Due-Date Tasks
A unique scheduling behavior where custom tasks assigned a **Due Date** automatically carry forward on the daily tasks list day-after-day until the due date expires or the user marks the task as completed.

### 3.7 Recurrence-Aware Modification & Deletion
When editing or deleting a recurring task occurrence, the app prompts the user to define the scope: **Current Day Only** (isolating and detaching that specific occurrence from the master template), **Day Range**, or **All Recurring Instances**.

### 3.8 Persistent Timer Session Tracking
Active timers display real-time live elapsed duration and remaining time. To protect tracked metrics, active sessions are saved to persistent local storage when the app closes or crashes, and recalculated accurately upon reopening.

### 3.9 Actionable Reminder Notifications
Local alarm notifications trigger on schedule. When the notification appears on the device, the user can **Deep-link** directly to the task detail, background-dismiss the alarm, or **Snooze** the reminder for 5, 10, or 30 minutes (re-scheduling the notification automatically).

### 3.10 Categories Customization & Settings
Users can configure the application in settings, including dark/light theme, default durations, week starts, and languages. Custom task categories can be added, updated, or deleted with instant image/photo upload for icons. Deleting a category automatically and safely moves existing tasks to the "Others" system category fallback.

---

## 4. Future Features
* Full multi-user collaboration (prepared at the database level with UUIDs and `owner_id` parameters).
* AI-driven calendar optimization (automatic rescheduling based on conflicts).
* Syncing with native device calendars (Google Calendar/Apple Calendar).

---

## 5. Success Criteria (Measurable Milestones)

An implementation of DailyTask is deemed successful if it meets the following criteria:

* **Conflict Resolution Effectiveness**: When any task is saved, the application checks for overlaps and alerts the user *before* writing to the database.
* **State Recovery Reliability**: Closing, killing, or restarting the device during a live tracking session results in zero data loss, with the timer resuming from the exact correct elapsed point upon reopening.
* **Midnight Rollover Execution**: The background scheduler triggers at exactly `00:00`, generating today's tasks and carrying forward uncompleted due-date tasks without needing a manual app refresh.
* **Referential Database Integrity**: Deleting customized categories re-categories dependent tasks to "Others" without corrupting database schedules.
