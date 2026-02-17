import { Logger } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import {
  resolveCorrelationId,
  serializeStructuredLog,
} from '../logging/structured-log.util';

type HttpCsrfOriginProtectionConfig = {
  enabled: boolean;
  trustedOrigins: string[];
  excludedPaths: string[];
  enforceMethods: string[];
  sessionCookieName?: string;
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

function resolveHeaderValue(
  headerValue: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(headerValue)) return headerValue[0];
  const normalized = String(headerValue || '').trim();
  return normalized || undefined;
}

function resolveHeaderHost(req: Request): string | undefined {
  const forwardedHost = resolveHeaderValue(req.headers['x-forwarded-host']);
  if (forwardedHost) return forwardedHost.toLowerCase();
  const host = resolveHeaderValue(req.headers.host);
  if (host) return host.toLowerCase();
  return undefined;
}

function resolveOriginFromHeaders(req: Request): string | undefined {
  const originHeader = resolveHeaderValue(req.headers.origin);
  if (originHeader && originHeader.toLowerCase() !== 'null') {
    try {
      return new URL(originHeader).origin.toLowerCase();
    } catch {
      return undefined;
    }
  }

  const refererHeader = resolveHeaderValue(req.headers.referer);
  if (!refererHeader) return undefined;
  try {
    return new URL(refererHeader).origin.toLowerCase();
  } catch {
    return undefined;
  }
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

function hasSessionCookie(req: Request, cookieName: string): boolean {
  const requestWithCookies = req as Request & { cookies?: unknown };
  const cookies =
    requestWithCookies.cookies &&
    typeof requestWithCookies.cookies === 'object' &&
    !Array.isArray(requestWithCookies.cookies)
      ? (requestWithCookies.cookies as Record<string, unknown>)
      : null;
  const directCookieValue = cookies?.[cookieName];
  if (typeof directCookieValue === 'string' && directCookieValue.trim()) {
    return true;
  }

  const cookieHeader = resolveHeaderValue(req.headers.cookie);
  if (!cookieHeader) return false;
  for (const chunk of cookieHeader.split(';')) {
    const [rawName, ...rawValueParts] = chunk.split('=');
    const normalizedName = String(rawName || '').trim();
    if (!normalizedName || normalizedName !== cookieName) continue;
    const rawValue = rawValueParts.join('=').trim();
    if (rawValue) return true;
  }
  return false;
}

function hasBearerAuthorization(req: Request): boolean {
  const authorization = resolveHeaderValue(req.headers.authorization);
  if (!authorization) return false;
  return /^Bearer\s+\S+/i.test(authorization);
}

export function createHttpCsrfOriginProtectionMiddleware(
  config: HttpCsrfOriginProtectionConfig,
  logger: Logger,
) {
  const sessionCookieName = String(config.sessionCookieName || 'token').trim();
  const trustedOrigins = new Set(
    (config.trustedOrigins || [])
      .map((origin) =>
        String(origin || '')
          .trim()
          .toLowerCase(),
      )
      .filter((origin) => origin.length > 0),
  );
  const excludedPaths = new Set(
    (config.excludedPaths || []).map((pathValue) => normalizePath(pathValue)),
  );
  const enforceMethods = new Set(
    (config.enforceMethods || [])
      .map((method) =>
        String(method || '')
          .trim()
          .toUpperCase(),
      )
      .filter((method) => method.length > 0),
  );

  return (req: Request, res: Response, next: NextFunction) => {
    if (!config.enabled) return next();
    if (req.method === 'OPTIONS') return next();
    if (!enforceMethods.has(String(req.method || '').toUpperCase())) {
      return next();
    }

    const pathValue = resolveRequestPath(req);
    if (isPathExcluded(pathValue, excludedPaths)) return next();

    if (!hasSessionCookie(req, sessionCookieName)) return next();
    if (hasBearerAuthorization(req)) return next();

    const requestOrigin = resolveOriginFromHeaders(req);
    const requestHost = resolveHeaderHost(req);
    const normalizedRequestOrigin = requestOrigin || '';
    const sameHostOriginAllowed =
      Boolean(normalizedRequestOrigin) &&
      Boolean(requestHost) &&
      new URL(normalizedRequestOrigin).host.toLowerCase() === requestHost;
    const trustedOriginAllowed =
      Boolean(normalizedRequestOrigin) &&
      trustedOrigins.has(normalizedRequestOrigin);

    if (trustedOriginAllowed || sameHostOriginAllowed) {
      return next();
    }

    const requestId = resolveCorrelationId(
      (res.getHeader('x-request-id') as string | string[] | undefined) ||
        req.headers['x-request-id'],
    );
    res.setHeader('x-request-id', requestId);
    logger.warn(
      serializeStructuredLog({
        event: 'http_csrf_origin_blocked',
        requestId,
        method: req.method,
        path: pathValue,
        origin: requestOrigin || null,
        host: requestHost || null,
        reason: requestOrigin ? 'origin-not-trusted' : 'missing-origin-header',
      }),
    );
    res.status(403).json({
      message: 'CSRF origin validation failed.',
      requestId,
    });
  };
}
