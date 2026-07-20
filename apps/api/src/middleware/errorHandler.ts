import { Request, Response, NextFunction } from 'express';

/**
 * Structured application error that serialises to RFC 7807 Problem Details.
 */
export class AppError extends Error {
  readonly status: number;
  readonly type: string;
  readonly detail: string;

  constructor(
    status: number,
    title: string,
    detail: string,
    type?: string,
  ) {
    super(title);
    this.name = 'AppError';
    this.status = status;
    this.detail = detail;
    this.type =
      type ??
      `https://dailytask.app/errors/${title
        .toLowerCase()
        .replace(/\s+/g, '-')}`;

    // Restore prototype chain (needed when compiling to ES5)
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** 404 handler — mount after all real routes. */
export function notFound(req: Request, res: Response): void {
  res.status(404).json({
    type: 'https://dailytask.app/errors/not-found',
    title: 'Not Found',
    status: 404,
    detail: `The requested resource '${req.path}' does not exist.`,
    instance: req.path,
  });
}

/** Central error handler — must be the last middleware registered. */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.status).json({
      type: err.type,
      title: err.message,
      status: err.status,
      detail: err.detail,
      instance: req.path,
    });
    return;
  }

  // Log unexpected errors in non-production environments
  if (process.env.NODE_ENV !== 'production') {
    console.error('[ERROR]', err);
  } else {
    console.error('[ERROR]', err.message);
  }

  res.status(500).json({
    type: 'https://dailytask.app/errors/internal-server-error',
    title: 'Internal Server Error',
    status: 500,
    detail:
      process.env.NODE_ENV === 'production'
        ? 'An unexpected error occurred.'
        : (err.message ?? 'Unknown error'),
    instance: req.path,
  });
}
