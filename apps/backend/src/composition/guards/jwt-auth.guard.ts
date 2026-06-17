// apps/backend/src/composition/guards/jwt-auth.guard.ts
// Composition-layer binding: extracts the JWT from the HttpOnly cookie,
// verifies via IJwtGateway, and attaches the user to the request.

import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { JWT_GATEWAY, IJwtGateway } from '../../core/application/ports/gateways/jwt.gateway';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(@Inject(JWT_GATEWAY) private readonly jwt: IJwtGateway) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request & { user?: unknown }>();
    const token = req.cookies?.['token'] ?? this.extractFromAuthHeader(req);
    if (!token) throw new UnauthorizedException('no auth token');
    try {
      req.user = this.jwt.verifyAccessToken(token);
      return true;
    } catch {
      throw new UnauthorizedException('invalid token');
    }
  }

  private extractFromAuthHeader(req: Request): string | null {
    const h = req.headers.authorization;
    if (!h?.startsWith('Bearer ')) return null;
    return h.slice('Bearer '.length);
  }
}
