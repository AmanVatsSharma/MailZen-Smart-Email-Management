import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AuthService } from '../auth.service';
import { serializeStructuredLog } from '../../common/logging/structured-log.util';

type JwtGuardRequest = {
  headers?: Record<string, string | string[] | undefined>;
  cookies?: Record<string, string | undefined>;
  user?: unknown;
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);
  private readonly sessionCookieName = this.resolveSessionCookieName();

  constructor(private readonly authService: AuthService) {}

  private resolveSessionCookieName(): string {
    const normalized = String(process.env.MAILZEN_SESSION_COOKIE_NAME || '')
      .trim()
      .toLowerCase();
    if (!normalized) return 'token';
    return normalized;
  }

  private getCookieToken(req: JwtGuardRequest | undefined): string | null {
    const direct = req?.cookies?.[this.sessionCookieName];
    if (typeof direct === 'string' && direct.length > 0) return direct;

    const header = req?.headers?.cookie;
    const cookieHeader = Array.isArray(header) ? header[0] : header;
    if (typeof cookieHeader !== 'string' || cookieHeader.length === 0)
      return null;

    const parts = cookieHeader.split(';');
    for (const part of parts) {
      const [kRaw, ...vParts] = part.split('=');
      if (!kRaw) continue;
      const key = kRaw.trim();
      if (key !== this.sessionCookieName) continue;
      const value = vParts.join('=').trim();
      if (!value) return null;
      try {
        return decodeURIComponent(value);
      } catch {
        return value;
      }
    }
    return null;
  }

  private getBearerToken(req: JwtGuardRequest | undefined): string | null {
    const authHeader = req?.headers?.authorization;
    const normalizedHeader = Array.isArray(authHeader)
      ? authHeader[0]
      : authHeader;
    if (typeof normalizedHeader !== 'string' || normalizedHeader.length === 0)
      return null;
    const [bearer, token] = normalizedHeader.split(' ');
    if (!/^Bearer$/i.test(bearer) || !token) return null;
    return token;
  }

  canActivate(context: ExecutionContext): boolean {
    const type = context.getType<'http' | 'graphql'>();
    const request: JwtGuardRequest | undefined =
      type === 'http'
        ? (context.switchToHttp().getRequest<JwtGuardRequest>() ?? undefined)
        : (GqlExecutionContext.create(context).getContext<{
            req?: JwtGuardRequest;
          }>()?.req ?? undefined);

    const token = this.getCookieToken(request) || this.getBearerToken(request);
    if (!token) throw new UnauthorizedException('Missing auth token');

    try {
      const user: unknown = this.authService.validateToken(token);
      if (request) request.user = user;
      return true;
    } catch (error) {
      if ((process.env.NODE_ENV || 'development') !== 'production') {
        this.logger.warn(
          serializeStructuredLog({
            event: 'jwt_auth_guard_token_validation_failed',
            message:
              error instanceof Error ? error.message : 'unknown auth error',
            requestType: type,
          }),
        );
      }
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
