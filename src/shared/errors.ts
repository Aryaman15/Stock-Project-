import type { NextFunction, Request, Response } from 'express';
export class AppError extends Error { constructor(public status: number, public code: string, message: string, public details?: unknown) { super(message); } }
export const notFound = (_req: Request, _res: Response, next: NextFunction) => next(new AppError(404, 'NOT_FOUND', 'Route not found'));
export const errorHandler = (err: unknown, req: Request, res: Response, _next: NextFunction) => {
  const e = err instanceof AppError ? err : new AppError(500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  res.status(e.status).json({ error: { code: e.code, message: e.message, ...(e.details === undefined ? {} : { details: e.details }), requestId: req.id } });
};
