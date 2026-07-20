import 'dotenv/config';
import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { getDatabase, closeDatabase } from './db/database';
import { errorHandler, notFound } from './middleware/errorHandler';
import { startMidnightScheduler } from './services/schedulerService';

// Route handlers
import healthRouter from './routes/health';
import categoriesRouter from './routes/categories';
import taskTemplatesRouter from './routes/taskTemplates';
import taskOccurrencesRouter from './routes/taskOccurrences';
import timerSessionsRouter from './routes/timerSessions';
import settingsRouter from './routes/settings';
import dashboardRouter from './routes/dashboard';
import syncRouter from './routes/sync';

// ─── App factory (exportable for testing) ────────────────────────────────────

export function createApp(): Application {
  const app = express();

  // ── Security ────────────────────────────────────────────────────────────────
  app.use(helmet());

  const allowedOrigins = process.env['CORS_ORIGIN']
    ? process.env['CORS_ORIGIN'].split(',').map((o) => o.trim())
    : ['*'];

  app.use(
    cors({
      origin: allowedOrigins.includes('*') ? '*' : allowedOrigins,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: !allowedOrigins.includes('*'),
    }),
  );

  // ── Body parsing ────────────────────────────────────────────────────────────
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // ── Request logging (dev only) ──────────────────────────────────────────────
  if (process.env['NODE_ENV'] !== 'production') {
    app.use((req, _res, next) => {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
      next();
    });
  }

  // ── API Routes ───────────────────────────────────────────────────────────────
  app.use('/api/v1/health',            healthRouter);
  app.use('/api/v1/categories',        categoriesRouter);
  app.use('/api/v1/task-templates',    taskTemplatesRouter);
  app.use('/api/v1/task-occurrences',  taskOccurrencesRouter);
  app.use('/api/v1/timer-sessions',    timerSessionsRouter);
  app.use('/api/v1/settings',          settingsRouter);
  app.use('/api/v1/dashboard',         dashboardRouter);
  app.use('/api/v1/sync',              syncRouter);

  // ── Root redirect ────────────────────────────────────────────────────────────
  app.get('/', (_req, res) => {
    res.json({ name: 'DailyTask API', version: '1.0.0', docs: '/api/v1/health' });
  });

  // ── 404 + global error handler ───────────────────────────────────────────────
  app.use(notFound);
  app.use(errorHandler);

  return app;
}

// ─── Bootstrap ───────────────────────────────────────────────────────────────

const PORT = parseInt(process.env['PORT'] ?? '3000', 10);

// Eagerly initialise DB so schema / seed errors surface immediately
try {
  getDatabase();
  console.log('[DB] SQLite database initialised successfully');
} catch (err) {
  console.error('[DB] Failed to initialise database:', err);
  process.exit(1);
}

// Start midnight cron scheduler
startMidnightScheduler();

const app = createApp();
const server = app.listen(PORT, () => {
  console.log(`[Server] DailyTask API  ▶  http://localhost:${PORT}`);
  console.log(`[Server] Environment    ▶  ${process.env['NODE_ENV'] ?? 'development'}`);
  console.log(`[Server] Press Ctrl+C to stop`);
});

// ─── Graceful shutdown ────────────────────────────────────────────────────────

function shutdown(signal: string): void {
  console.log(`\n[Server] ${signal} received — shutting down gracefully…`);
  server.close(() => {
    closeDatabase();
    console.log('[Server] Closed. Goodbye!');
    process.exit(0);
  });

  // Force-exit after 10 s if connections don't drain
  setTimeout(() => {
    console.error('[Server] Could not close in time — forcing exit');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

export default app;
