import { ForbiddenException } from '@nestjs/common';
import { AdminGuard } from './admin.guard';

describe('AdminGuard', () => {
  const guard = new AdminGuard();

  const createHttpContext = (user: unknown): any => ({
    getType: jest.fn().mockReturnValue('http'),
    switchToHttp: jest.fn().mockReturnValue({
      getRequest: jest.fn().mockReturnValue({ user }),
    }),
  });

  it('allows request when role field is ADMIN', () => {
    const context = createHttpContext({ role: 'ADMIN' });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows request when roles array includes ADMIN', () => {
    const context = createHttpContext({ roles: ['USER', 'ADMIN'] });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('denies request when user is not admin', () => {
    const context = createHttpContext({ role: 'USER' });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
