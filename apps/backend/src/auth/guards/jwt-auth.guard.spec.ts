/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AuthService } from '../auth.service';

describe('JwtAuthGuard', () => {
  type GuardRequest = {
    headers: Record<string, string>;
    cookies?: Record<string, string>;
    user?: unknown;
  };

  const authServiceMock: jest.Mocked<Pick<AuthService, 'validateToken'>> = {
    validateToken: jest.fn(),
  };
  const guard = new JwtAuthGuard(authServiceMock as unknown as AuthService);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function createHttpContext(request: GuardRequest): ExecutionContext {
    return {
      getType: jest.fn().mockReturnValue('http'),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(request),
      }),
    } as unknown as ExecutionContext;
  }

  it('authenticates bearer token requests', () => {
    const request: GuardRequest = {
      headers: {
        authorization: 'Bearer token-123',
      },
    };
    authServiceMock.validateToken.mockReturnValue({
      id: 'user-1',
      email: 'owner@mailzen.com',
    } as never);

    expect(guard.canActivate(createHttpContext(request))).toBe(true);
    expect(authServiceMock.validateToken).toHaveBeenCalledWith('token-123');
    expect(request).toEqual(
      expect.objectContaining({
        user: expect.objectContaining({ id: 'user-1' }),
      }),
    );
  });

  it('authenticates cookie token requests', () => {
    const request: GuardRequest = {
      headers: {
        cookie: 'token=cookie-token',
      },
    };
    authServiceMock.validateToken.mockReturnValue({
      id: 'user-2',
    } as never);

    expect(guard.canActivate(createHttpContext(request))).toBe(true);
    expect(authServiceMock.validateToken).toHaveBeenCalledWith('cookie-token');
  });

  it('throws unauthorized when token is missing', () => {
    const request: GuardRequest = {
      headers: {},
    };

    expect(() => guard.canActivate(createHttpContext(request))).toThrow(
      UnauthorizedException,
    );
    expect(authServiceMock.validateToken).not.toHaveBeenCalled();
  });

  it('throws unauthorized when token validation fails', () => {
    const request: GuardRequest = {
      headers: {
        authorization: 'Bearer invalid-token',
      },
    };
    authServiceMock.validateToken.mockImplementation(() => {
      throw new Error('invalid');
    });

    expect(() => guard.canActivate(createHttpContext(request))).toThrow(
      UnauthorizedException,
    );
    expect(authServiceMock.validateToken).toHaveBeenCalledWith('invalid-token');
  });
});
