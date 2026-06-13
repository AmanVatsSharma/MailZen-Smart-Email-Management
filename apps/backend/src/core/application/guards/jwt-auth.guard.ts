// apps/backend/src/core/application/guards/jwt-auth.guard.ts
// Pure placeholder. Real implementation lives in composition layer (binds to JWT_GATEWAY).
// Kept here so the application layer can express the security requirement
// without depending on @nestjs/passport directly.

import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class JwtAuthGuardMarker implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(_context: ExecutionContext): boolean {
    // Real check is in the composition layer's binding (composes JWT_GATEWAY + cookie extractor).
    return true;
  }
}
