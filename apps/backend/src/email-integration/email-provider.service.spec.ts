/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  BadRequestException,
  ConflictException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { createTransport } from 'nodemailer';
import { Repository } from 'typeorm';
import { BillingService } from '../billing/billing.service';
import { WorkspaceService } from '../workspace/workspace.service';
import { EmailProviderInput } from './dto/email-provider.input';
import { EmailProvider } from './entities/email-provider.entity';
import { EmailProviderService } from './email-provider.service';

jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    verify: jest.fn().mockResolvedValue(true),
    close: jest.fn(),
  }),
}));

jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({
    setCredentials: jest.fn(),
    refreshAccessToken: jest.fn().mockResolvedValue({
      credentials: {
        access_token: 'refreshed-access-token',
        expiry_date: Date.now() + 3600000,
      },
    }),
  })),
}));

describe('EmailProviderService', () => {
  let service: EmailProviderService;
  let providerRepository: jest.Mocked<Repository<EmailProvider>>;
  const billingServiceMock = {
    getEntitlements: jest.fn().mockResolvedValue({
      planCode: 'PRO',
      providerLimit: 5,
      mailboxLimit: 5,
      workspaceLimit: 5,
      aiCreditsPerMonth: 500,
    }),
  };
  const workspaceServiceMock = {
    listMyWorkspaces: jest.fn().mockResolvedValue([
      {
        id: 'workspace-1',
        isPersonal: true,
      },
    ]),
  };

  beforeEach(async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(global, 'setInterval').mockImplementation((() => 0) as any);

    const repoMock = {
      findOne: jest.fn(),
      find: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
    } as unknown as jest.Mocked<Repository<EmailProvider>>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailProviderService,
        { provide: getRepositoryToken(EmailProvider), useValue: repoMock },
        { provide: BillingService, useValue: billingServiceMock },
        { provide: WorkspaceService, useValue: workspaceServiceMock },
      ],
    }).compile();

    service = module.get<EmailProviderService>(EmailProviderService);
    providerRepository = module.get(getRepositoryToken(EmailProvider));
    providerRepository.count.mockResolvedValue(0);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('auto-detects Gmail and saves provider', async () => {
    const input: EmailProviderInput = {
      autoDetect: true,
      providerType: 'CUSTOM_SMTP',
      email: 'founder@gmail.com',
      accessToken: 'access-token',
    } as EmailProviderInput;
    const created = {
      id: 'provider-1',
      type: 'GMAIL',
      email: 'founder@gmail.com',
      accessToken: 'access-token',
      userId: 'user-1',
    } as EmailProvider;

    providerRepository.findOne.mockResolvedValue(null);
    providerRepository.create.mockReturnValue(created);
    providerRepository.save.mockResolvedValue(created);

    const result = await service.configureProvider(input, 'user-1');

    expect(providerRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'GMAIL',
        email: 'founder@gmail.com',
        accessToken: expect.stringMatching(/^enc:v2:/),
        workspaceId: 'workspace-1',
        userId: 'user-1',
      }),
    );
    expect(result.type).toBe('GMAIL');
  });

  it('rejects provider creation when entitlement limit is reached', async () => {
    providerRepository.count.mockResolvedValue(5);

    await expect(
      service.configureProvider(
        {
          providerType: 'CUSTOM_SMTP',
          email: 'ops@example.com',
          host: 'smtp.example.com',
          port: 587,
          password: 'secret',
        } as EmailProviderInput,
        'user-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws conflict when provider already exists', async () => {
    providerRepository.findOne.mockResolvedValue({
      id: 'existing',
      email: 'founder@gmail.com',
      type: 'GMAIL',
      userId: 'user-1',
    } as any);

    await expect(
      service.configureProvider(
        {
          providerType: 'GMAIL',
          email: 'founder@gmail.com',
          accessToken: 'token',
        } as any,
        'user-1',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects SMTP provider configuration without required fields', async () => {
    providerRepository.findOne.mockResolvedValue(null);

    await expect(
      service.configureProvider(
        {
          providerType: 'CUSTOM_SMTP',
          email: 'ops@example.com',
        } as any,
        'user-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns provider emails for owner', async () => {
    const emails = [{ id: 'mail-1' }, { id: 'mail-2' }];
    providerRepository.findOne.mockResolvedValue({
      id: 'provider-1',
      userId: 'user-1',
      emails,
    } as any);

    const result = await service.getProviderEmails('provider-1', 'user-1');

    expect(providerRepository.findOne).toHaveBeenCalledWith({
      where: {
        id: 'provider-1',
        userId: 'user-1',
      },
      relations: ['emails'],
    });
    expect(result).toEqual(emails);
  });

  it('throws NotFoundException when provider cannot be deleted', async () => {
    providerRepository.findOne.mockResolvedValue(null);

    await expect(
      service.deleteProvider('missing-provider', 'user-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('updates credentials for SMTP provider', async () => {
    providerRepository.findOne
      .mockResolvedValueOnce({
        id: 'provider-1',
        type: 'CUSTOM_SMTP',
        userId: 'user-1',
      } as any)
      .mockResolvedValueOnce({
        id: 'provider-1',
        type: 'CUSTOM_SMTP',
        host: 'smtp.new-host.com',
      } as any);
    providerRepository.update.mockResolvedValue({} as any);

    await service.updateProviderCredentials(
      'provider-1',
      {
        host: 'smtp.new-host.com',
        port: 587,
        password: 'new-password',
      },
      'user-1',
    );

    expect(providerRepository.update).toHaveBeenCalledWith(
      'provider-1',
      expect.objectContaining({
        host: 'smtp.new-host.com',
        port: 587,
        password: expect.stringMatching(/^enc:v2:/),
      }),
    );
  });

  it('creates SMTP transporter with enterprise pooling config', async () => {
    await service.getTransporter({
      id: 'provider-1',
      type: 'CUSTOM_SMTP',
      email: 'ops@example.com',
      host: 'smtp.example.com',
      port: 587,
      password: 'secret',
    });

    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'smtp.example.com',
        port: 587,
        pool: true,
      }),
    );
  });
});
