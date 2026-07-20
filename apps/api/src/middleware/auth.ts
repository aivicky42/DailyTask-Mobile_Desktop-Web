import { Request, Response, NextFunction } from 'express';

/**
 * Authentication middleware stub for v1.
 *
 * In v1 the app is single-user / local-first, so every request passes through
 * without token validation.  The `owner_id` on every DB row is left NULL
 * (anonymous user).
 *
 * TODO(v2): validate a Bearer JWT, populate `req.user`, and set `owner_id`
 *           on DB writes so data is properly scoped per user.
 */
export function authenticate(
  _req: Request,
  _res: Response,
  next: NextFunction,
): void {
  next();
}
