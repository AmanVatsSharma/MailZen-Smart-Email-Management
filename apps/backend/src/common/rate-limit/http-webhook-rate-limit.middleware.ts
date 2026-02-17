import { Logger } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import {
  fingerprintIdentifier,
  resolveCorrelationId,
  serializeStructuredLog,
} from '../logging/structured-log.util';
import { RequestRateLimiter } from './request-rate-limiter';

type HttpWebhookRateLimitConfig = {
  enabled: boolean;
  windowMs: number;
  maxRequests: number;
  webhookPaths: string[];
  enforceMethods: string[];
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

function isWebhookPath(pathValue: string, webhookPaths: Set<string>): boolean {
  if (!webhookPaths.size) return false;
  for (const webhookPath of webhookPaths) {
    if (!webhookPath) continue;
    if (pathValue === webhookPath) return true;
    if (pathValue.startsWith(`${webhookPath}/`)) return true;
  }
  return false;
}

export function createHttpWebhookRateLimitMiddleware(
  config: HttpWebhookRateLimitConfig,
  logger: Logger,
) {
  const limiter = new RequestRateLimiter({
    windowMs: config.windowMs,
    maxRequests: config.maxRequests,
  });
  const webhookPaths = new Set(
    (config.webhookPaths || []).map((pathValue) => normalizePath(pathValue)),
  );
  const enforceMethods = new Set(
    (config.enforceMethods || [])
      .map((methodValue) =>
        String(methodValue || '')
          .trim()
          .toUpperCase(),
      )
      .filter(Boolean),
  );
  const hasConfiguredWebhookPaths = webhookPaths.size > 0;
  if (config.enabled && !hasConfiguredWebhookPaths) {
    logger.warn(
      serializeStructuredLog({
        event: 'http_webhook_rate_limit_paths_missing',
      }),
    );
  }

  return (req: Request, res: Response, next: NextFunction) => {
    if (!config.enabled) return next();
    if (!hasConfiguredWebhookPaths) return next();
    if (enforceMethods.size && !enforceMethods.has(req.method.toUpperCase())) {
      return next();
    }
    if (req.method === 'OPTIONS') return next();

    const pathValue = resolveRequestPath(req);
    if (!isWebhookPath(pathValue, webhookPaths)) return next();

    const clientIdentifier = resolveClientIdentifier(req);
    const key = `${clientIdentifier}:${pathValue}`;
    const rateLimitResult = limiter.consume(key);
    res.setHeader('x-webhook-rate-limit-limit', String(config.maxRequests));
    res.setHeader(
      'x-webhook-rate-limit-remaining',
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
        event: 'http_webhook_rate_limited',
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
      message: 'Too many webhook requests. Please retry later.',
      requestId,
      retryAfterSeconds: rateLimitResult.retryAfterSeconds,
    });
  };
}
