import { Router, Request, Response } from 'express';
import { checkDatabaseHealth } from '../db/database';
import { HealthResponse } from '../types';

const router = Router();

/** GET /api/v1/health — public liveness + readiness probe */
router.get('/', (_req: Request, res: Response) => {
  const dbOk = checkDatabaseHealth();

  const body: HealthResponse = {
    status: dbOk ? 'ok' : 'degraded',
    database: dbOk ? 'connected' : 'error',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  };

  res.status(dbOk ? 200 : 503).json(body);
});

export default router;
