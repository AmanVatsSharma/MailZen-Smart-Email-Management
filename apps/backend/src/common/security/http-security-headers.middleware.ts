import { NextFunction, Request, Response } from 'express';

type HttpSecurityHeadersConfig = {
  enabled: boolean;
  contentTypeNosniffEnabled: boolean;
  frameOptions: 'DENY' | 'SAMEORIGIN';
  referrerPolicy: string;
  permissionsPolicy?: string;
  crossOriginOpenerPolicy:
    | 'same-origin'
    | 'same-origin-allow-popups'
    | 'unsafe-none';
  hstsEnabled: boolean;
  hstsMaxAgeSeconds: number;
  hstsIncludeSubdomains: boolean;
  hstsPreload: boolean;
};

function resolveStrictTransportSecurityValue(
  config: HttpSecurityHeadersConfig,
): string {
  const directives = [`max-age=${Math.max(config.hstsMaxAgeSeconds, 1)}`];
  if (config.hstsIncludeSubdomains) directives.push('includeSubDomains');
  if (config.hstsPreload) directives.push('preload');
  return directives.join('; ');
}

export function createHttpSecurityHeadersMiddleware(
  config: HttpSecurityHeadersConfig,
) {
  return (_req: Request, res: Response, next: NextFunction) => {
    if (!config.enabled) return next();

    if (config.contentTypeNosniffEnabled) {
      res.setHeader('x-content-type-options', 'nosniff');
    }
    res.setHeader('x-frame-options', config.frameOptions);
    if (config.referrerPolicy) {
      res.setHeader('referrer-policy', config.referrerPolicy);
    }
    if (config.permissionsPolicy && config.permissionsPolicy.trim()) {
      res.setHeader('permissions-policy', config.permissionsPolicy.trim());
    }
    res.setHeader('cross-origin-opener-policy', config.crossOriginOpenerPolicy);
    if (config.hstsEnabled) {
      res.setHeader(
        'strict-transport-security',
        resolveStrictTransportSecurityValue(config),
      );
    }
    next();
  };
}
