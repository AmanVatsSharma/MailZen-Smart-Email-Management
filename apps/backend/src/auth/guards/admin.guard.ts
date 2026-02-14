import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const type = context.getType<'http' | 'graphql' | string>();
    const request =
      type === 'http'
        ? context.switchToHttp().getRequest()
        : GqlExecutionContext.create(context).getContext().req;
    const user = request?.user;

    const hasRoleField =
      typeof user?.role === 'string' && user.role === 'ADMIN';
    const hasRolesArray =
      Array.isArray(user?.roles) && user.roles.includes('ADMIN');

    if (hasRoleField || hasRolesArray) {
      return true;
    }

    throw new ForbiddenException('Access denied: Admins only');
  }
}
