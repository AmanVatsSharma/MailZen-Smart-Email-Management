import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const ctx = GqlExecutionContext.create(context);
    const user = ctx.getContext().req.user;
    if (user && user.roles && Array.isArray(user.roles) && user.roles.includes('ADMIN')) {
      return true;
    }
    throw new ForbiddenException('Access denied: Admins only');
  }
} 