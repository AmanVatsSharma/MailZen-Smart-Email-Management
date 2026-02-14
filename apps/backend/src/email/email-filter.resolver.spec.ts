import { Test, TestingModule } from '@nestjs/testing';
import { EmailFilterResolver } from './email.email-filter.resolver';
import { EmailFilterService } from './email.email-filter.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuthService } from '../auth/auth.service';

describe('EmailFilterResolver (smoke)', () => {
  let resolver: EmailFilterResolver;
  let service: any;

  const userId = 'user-1';
  const mockContext = { req: { user: { id: userId } } };

  const mockEmailFilterService = {
    createFilter: jest.fn().mockResolvedValue({ id: 'f1' }),
    getFilters: jest
      .fn()
      .mockResolvedValue([{ id: 'f1', name: 'My Filter', rules: [] }]),
    deleteFilter: jest.fn().mockResolvedValue({ id: 'f1' }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailFilterResolver,
        { provide: EmailFilterService, useValue: mockEmailFilterService },
        JwtAuthGuard,
        {
          provide: AuthService,
          useValue: {
            validateToken: jest.fn().mockReturnValue({ id: userId }),
          },
        },
      ],
    }).compile();

    resolver = module.get(EmailFilterResolver);
    service = module.get(EmailFilterService);
  });

  afterEach(() => jest.clearAllMocks());

  it('createEmailFilter delegates to service.createFilter and returns true', async () => {
    const ok = await resolver.createEmailFilter(
      { name: 'My Filter', rules: [] } as any,
      mockContext as any,
    );
    expect(service.createFilter).toHaveBeenCalledWith(
      { name: 'My Filter', rules: [] },
      userId,
    );
    expect(ok).toBe(true);
  });

  it('getEmailFilters delegates and returns stringified filters', async () => {
    const res = await resolver.getEmailFilters(mockContext as any);
    expect(service.getFilters).toHaveBeenCalledWith(userId);
    expect(Array.isArray(res)).toBe(true);
    expect(typeof res[0]).toBe('string');
  });

  it('deleteEmailFilter delegates and returns true', async () => {
    const ok = await resolver.deleteEmailFilter('f1', mockContext as any);
    expect(service.deleteFilter).toHaveBeenCalledWith('f1', userId);
    expect(ok).toBe(true);
  });
});
