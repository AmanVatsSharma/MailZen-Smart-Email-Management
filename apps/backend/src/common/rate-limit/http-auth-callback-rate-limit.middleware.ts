import { Logger } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import {
  fingerprintIdentifier,
  resolveCorrelationId,
  serializeStructuredLog,
} from '../logging/structured-log.util';
import { RequestRateLimiter } from './request-rate-limiter';

type HttpAuthCallbackRateLimitConfig = {
  enabled: boolean;
  windowMs: number;
  maxRequests: number;
  callbackPaths: string[];
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

function isCallbackPath(
  pathValue: string,
  callbackPaths: Set<string>,
): boolean {
  if (!callbackPaths.size) return false;
  for (const callbackPath of callbackPaths) {
    if (!callbackPath) continue;
    if (pathValue === callbackPath) return true;
    if (pathValue.startsWith(`${callbackPath}/`)) return true;
  }
  return false;
}

export function createHttpAuthCallbackRateLimitMiddleware(
  config: HttpAuthCallbackRateLimitConfig,
  logger: Logger,
) {
  const limiter = new RequestRateLimiter({
    windowMs: config.windowMs,
    maxRequests: config.maxRequests,
  });
  const callbackPaths = new Set(
    (config.callbackPaths || []).map((pathValue) => normalizePath(pathValue)),
  );

  return (req: Request, res: Response, next: NextFunction) => {
    if (!config.enabled) return next();
    if (req.method === 'OPTIONS') return next();

    const pathValue = resolveRequestPath(req);
    if (!isCallbackPath(pathValue, callbackPaths)) return next();

    const clientIdentifier = resolveClientIdentifier(req);
    const key = `${clientIdentifier}:${pathValue}`;
    const rateLimitResult = limiter.consume(key);
    res.setHeader(
      'x-auth-callback-rate-limit-limit',
      String(config.maxRequests),
    );
    res.setHeader(
      'x-auth-callback-rate-limit-remaining',
      String(rateLimitResult.remaining),
    );
    if (rateLimitResult.allowed) return next();

    const requestId = resolveCorrelationId(
      (res.getHeader('x-request-id') as string | string[] | undefined) ||
        req.headers['x-request-id'],
    );
    res.setHeader('x-request-id', requestId);
    res.setHeader(
      'retry-after',
      String(Math.max(rateLimitResult.retryAfterSeconds, 1)),
    );
    logger.warn(
      serializeStructuredLog({
        event: 'http_auth_callback_rate_limited',
        requestId,
        path: pathValue,
        method: req.method,
        clientFingerprint: fingerprintIdentifier(clientIdentifier),
        maxRequests: config.maxRequests,
        windowMs: config.windowMs,
        retryAfterSeconds: rateLimitResult.retryAfterSeconds,
      }),
    );
    res.status(429).json({
      message: 'Too many authentication callback attempts. Please retry later.',
      requestId,
      retryAfterSeconds: rateLimitResult.retryAfterSeconds,
    });
  };
}
