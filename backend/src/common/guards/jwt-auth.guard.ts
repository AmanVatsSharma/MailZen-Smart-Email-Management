import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AuthService } from '../../auth/auth.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  private getCookieToken(req: any): string | null {
    // If cookie-parser is present, this will exist. We do not depend on it.
    const direct = req?.cookies?.token;
    if (typeof direct === 'string' && direct.length > 0) return direct;

    const header: unknown = req?.headers?.cookie;
    if (typeof header !== 'string' || header.length === 0) return null;

    // Minimal robust parsing of Cookie header.
    // Handles: "a=b; token=xyz; c=d"
    const parts = header.split(';');
    for (const part of parts) {
      const [kRaw, ...vParts] = part.split('=');
      if (!kRaw) continue;
      const key = kRaw.trim();
      if (key !== 'token') continue;
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

  private getBearerToken(req: any): string | null {
    const authHeader: unknown = req?.headers?.authorization;
    if (typeof authHeader !== 'string' || authHeader.length === 0) return null;
    const [bearer, token] = authHeader.split(' ');
    if (!/^Bearer$/i.test(bearer) || !token) return null;
    return token;
  }

  canActivate(context: ExecutionContext): boolean {
    const ctx = GqlExecutionContext.create(context);
    const request = ctx.getContext().req;

    // Primary: HttpOnly cookie token. Fallback: Authorization header.
    const token = this.getCookieToken(request) || this.getBearerToken(request);
    if (!token) throw new UnauthorizedException('Missing auth token');

    try {
      const user = this.authService.validateToken(token);
      request.user = user;
      return true;
    } catch (error) {
      if ((process.env.NODE_ENV || 'development') !== 'production') {
        // Helpful debugging without leaking token value.
        console.warn('[JwtAuthGuard] token validation failed', { message: (error as any)?.message });
      }
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
} 