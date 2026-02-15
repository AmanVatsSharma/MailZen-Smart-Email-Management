import { Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { RequestRateLimiter } from './request-rate-limiter';

type HttpRateLimitConfig = {
  enabled: boolean;
  windowMs: number;
  maxRequests: number;
  excludedPaths: string[];
};

function normalizePath(pathValue: string): string {
  const path = String(pathValue || '').trim();
  return path.startsWith('/') ? path : `/${path}`;
}

function resolveRequestPath(req: Request): string {
  const sourcePath = req.path || req.originalUrl || req.url || '/';
  const [pathWithoutQuery] = sourcePath.split('?');
  return normalizePath(pathWithoutQuery || '/');
}

function resolveClientIdentifier(req: Request): string {
  const requestUser = (req as Request & { user?: { id?: string } }).user;
  if (requestUser?.id) return `user:${requestUser.id}`;

  const forwardedForHeader = req.headers['x-forwarded-for'];
  const forwardedForValue = Array.isArray(forwardedForHeader)
    ? forwardedForHeader[0]
    : forwardedForHeader;
  if (forwardedForValue) {
    const [firstIp] = forwardedForValue.split(',');
    const normalizedFirstIp = String(firstIp || '').trim();
    if (normalizedFirstIp) return `ip:${normalizedFirstIp}`;
  }
  return `ip:${req.ip || 'unknown'}`;
}

function isPathExcluded(
  pathValue: string,
  excludedPaths: Set<string>,
): boolean {
  if (!excludedPaths.size) return false;
  for (const excludedPath of excludedPaths) {
    if (!excludedPath) continue;
    if (pathValue === excludedPath) return true;
    if (pathValue.startsWith(`${excludedPath}/`)) return true;
  }
  return false;
}

export function createHttpRateLimitMiddleware(
  config: HttpRateLimitConfig,
  logger: Logger,
) {
  const limiter = new RequestRateLimiter({
    windowMs: config.windowMs,
    maxRequests: config.maxRequests,
  });
  const excludedPaths = new Set(
    (config.excludedPaths || []).map((pathValue) => normalizePath(pathValue)),
  );

  return (req: Request, res: Response, next: NextFunction) => {
    if (!config.enabled) return next();
    if (req.method === 'OPTIONS') return next();

    const pathValue = resolveRequestPath(req);
    if (isPathExcluded(pathValue, excludedPaths)) return next();

    const clientIdentifier = resolveClientIdentifier(req);
    const key = `${clientIdentifier}:${pathValue}`;
    const rateLimitResult = limiter.consume(key);
    res.setHeader('x-rate-limit-limit', String(config.maxRequests));
    res.setHeader('x-rate-limit-remaining', String(rateLimitResult.remaining));
    if (rateLimitResult.allowed) return next();

    const requestIdHeader = res.getHeader('x-request-id');
    const requestId = String(requestIdHeader || randomUUID());
    res.setHeader('x-request-id', requestId);
    res.setHeader(
      'retry-after',
      String(Math.max(rateLimitResult.retryAfterSeconds, 1)),
    );
    logger.warn(
      JSON.stringify({
        event: 'http_rate_limited',
        requestId,
        method: req.method,
        path: pathValue,
        clientIdentifier,
        maxRequests: config.maxRequests,
        windowMs: config.windowMs,
        retryAfterSeconds: rateLimitResult.retryAfterSeconds,
      }),
    );
    res.status(429).json({
      message: 'Too many requests. Please retry later.',
      requestId,
      retryAfterSeconds: rateLimitResult.retryAfterSeconds,
    });
  };
}
