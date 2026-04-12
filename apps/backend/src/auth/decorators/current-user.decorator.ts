import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

/**
 * Extracts the authenticated user from the GraphQL or HTTP request context.
 * Works alongside JwtAuthGuard / GqlAuthGuard which populates req.user.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext) => {
    const type = context.getType<'http' | 'graphql'>();
    if (type === 'graphql') {
      const ctx = GqlExecutionContext.create(context).getContext<{
        req?: { user?: unknown };
      }>();
      return ctx?.req?.user;
    }
    return context.switchToHttp().getRequest<{ user?: unknown }>()?.user;
  },
);
