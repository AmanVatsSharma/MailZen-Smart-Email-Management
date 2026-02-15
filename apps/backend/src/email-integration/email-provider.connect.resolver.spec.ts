import { Test, TestingModule } from '@nestjs/testing';
import { EmailProviderConnectResolver } from './email-provider.connect.resolver';
import { EmailProviderService } from './email-provider.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

describe('EmailProviderConnectResolver', () => {
  let resolver: EmailProviderConnectResolver;

  const emailProviderServiceMock = {
    connectGmail: jest.fn(),
    connectOutlook: jest.fn(),
    connectSmtp: jest.fn(),
    disconnectProvider: jest.fn(),
    setActiveProvider: jest.fn(),
    syncProvider: jest.fn(),
    listProvidersUi: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        EmailProviderConnectResolver,
        { provide: EmailProviderService, useValue: emailProviderServiceMock },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    resolver = moduleRef.get(EmailProviderConnectResolver);
  });

  it('delegates syncProvider to email provider service', async () => {
    emailProviderServiceMock.syncProvider.mockResolvedValue({
      id: 'provider-1',
      status: 'connected',
    });

    const context = { req: { user: { id: 'user-1' } } };
    const result = await resolver.syncProvider('provider-1', context);

    expect(result).toEqual({
      id: 'provider-1',
      status: 'connected',
    });
    expect(emailProviderServiceMock.syncProvider).toHaveBeenCalledWith(
      'provider-1',
      'user-1',
    );
  });

  it('passes workspace filter to providers query', async () => {
    emailProviderServiceMock.listProvidersUi.mockResolvedValue([
      { id: 'provider-1' },
    ]);
    const context = { req: { user: { id: 'user-1' } } };

    const result = await resolver.providers('workspace-1', context);

    expect(result).toEqual([{ id: 'provider-1' }]);
    expect(emailProviderServiceMock.listProvidersUi).toHaveBeenCalledWith(
      'user-1',
      'workspace-1',
    );
  });
});
