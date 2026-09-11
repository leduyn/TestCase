import { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function requestIdMiddleware(req: Request, _res: Response, next: NextFunction) {
  (req as any).id = generateRequestId();
  (req as any).startTime = Date.now();
  next();
}

export function responseTimeMiddleware(req: Request, res: Response, next: NextFunction) {
  res.on('finish', () => {
    const duration = Date.now() - ((req as any).startTime || Date.now());
    console.error(`[${new Date().toISOString()}] ${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });
  next();
}

export function errorHandler(err: AppError, req: Request, res: Response, next: NextFunction) {
  const statusCode = err.statusCode || 500;
  const isDev = process.env.NODE_ENV === 'development';
  const message = err.isOperational ? err.message : 'Internal server error';

  console.error({
    timestamp: new Date().toISOString(),
    requestId: (req as any).id,
    method: req.method,
    path: req.path,
    userId: (req as any).user?.id || 'anonymous',
    statusCode,
    error: err.message,
    stack: isDev ? err.stack : undefined,
  });

  res.status(statusCode).json({
    message,
    ...(isDev && { stack: err.stack, requestId: (req as any).id }),
  });
}

export function notFoundHandler(req: Request, _res: Response, next: NextFunction) {
  const err = new Error(`Route not found: ${req.method} ${req.path}`) as AppError;
  err.statusCode = 404;
  err.isOperational = true;
  next(err);
}
