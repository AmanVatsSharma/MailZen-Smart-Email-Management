import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import axios from 'axios';
import { Mailbox } from './entities/mailbox.entity';
import {
  encryptProviderSecret,
  ProviderSecretsKeyring,
  resolveProviderSecretsKeyring,
} from '../common/provider-secrets.util';

@Injectable()
export class MailServerService {
  private readonly logger = new Logger(MailServerService.name);
  private readonly providerSecretsKeyring: ProviderSecretsKeyring;

  private static readonly MAILZEN_DOMAIN = 'mailzen.com';

  constructor(
    @InjectRepository(Mailbox)
    private readonly mailboxRepo: Repository<Mailbox>,
  ) {
    try {
      this.providerSecretsKeyring = resolveProviderSecretsKeyring();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Mailbox keyring resolve failed: ${message}`);
      throw new InternalServerErrorException(
        'Mailbox credential encryption keyring is misconfigured',
      );
    }
  }

  private getConnectionConfig() {
    return {
      smtpHost: process.env.MAILZEN_SMTP_HOST || 'smtp.mailzen.local',
      smtpPort: parseInt(process.env.MAILZEN_SMTP_PORT || '587', 10),
      imapHost: process.env.MAILZEN_IMAP_HOST || 'imap.mailzen.local',
      imapPort: parseInt(process.env.MAILZEN_IMAP_PORT || '993', 10),
    };
  }

  private resolveMailAdminProvider(): 'GENERIC' | 'MAILCOW' | 'MAILU' {
    const rawProvider = String(process.env.MAILZEN_MAIL_ADMIN_PROVIDER || '')
      .trim()
      .toUpperCase();
    if (!rawProvider) return 'GENERIC';
    if (rawProvider === 'MAILCOW') return 'MAILCOW';
    if (rawProvider === 'MAILU') return 'MAILU';
    if (rawProvider === 'GENERIC') return 'GENERIC';

    this.logger.warn(
      `Unknown MAILZEN_MAIL_ADMIN_PROVIDER=${rawProvider}; falling back to GENERIC`,
    );
    return 'GENERIC';
  }

  private resolveIntegerEnv(input: {
    rawValue: string | undefined;
    fallbackValue: number;
    minimumValue: number;
    maximumValue: number;
  }): number {
    const parsed = Number(input.rawValue);
    const normalized = Number.isFinite(parsed)
      ? Math.floor(parsed)
      : input.fallbackValue;
    if (normalized < input.minimumValue) return input.minimumValue;
    if (normalized > input.maximumValue) return input.maximumValue;
    return normalized;
  }

  private getAdminApiTimeoutMs(): number {
    return this.resolveIntegerEnv({
      rawValue: process.env.MAILZEN_MAIL_ADMIN_API_TIMEOUT_MS,
      fallbackValue: 5000,
      minimumValue: 500,
      maximumValue: 60_000,
    });
  }

  private getAdminApiRetries(): number {
    return this.resolveIntegerEnv({
      rawValue: process.env.MAILZEN_MAIL_ADMIN_API_RETRIES,
      fallbackValue: 2,
      minimumValue: 0,
      maximumValue: 5,
    });
  }

  private getAdminApiBackoffMs(): number {
    return this.resolveIntegerEnv({
      rawValue: process.env.MAILZEN_MAIL_ADMIN_API_RETRY_BACKOFF_MS,
      fallbackValue: 300,
      minimumValue: 50,
      maximumValue: 15_000,
    });
  }

  private getAdminApiJitterMs(): number {
    return this.resolveIntegerEnv({
      rawValue: process.env.MAILZEN_MAIL_ADMIN_API_RETRY_JITTER_MS,
      fallbackValue: 150,
      minimumValue: 0,
      maximumValue: 5_000,
    });
  }

  private resolveMailcowQuotaMb(overrideQuotaMb?: number | null): number {
    const override =
      typeof overrideQuotaMb === 'number' && Number.isFinite(overrideQuotaMb)
        ? Math.floor(overrideQuotaMb)
        : null;
    if (override && override > 0) {
      return this.resolveIntegerEnv({
        rawValue: String(override),
        fallbackValue: 51_200,
        minimumValue: 512,
        maximumValue: 1_000_000,
      });
    }
    return this.resolveIntegerEnv({
      rawValue: process.env.MAILZEN_MAIL_ADMIN_MAILCOW_QUOTA_MB,
      fallbackValue: 51_200,
      minimumValue: 512,
      maximumValue: 1_000_000,
    });
  }

  private async sleep(ms: number): Promise<void> {
    if (!Number.isFinite(ms) || ms <= 0) return;
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private normalizeAdminApiBaseUrl(rawUrl: string): string {
    return rawUrl.trim().replace(/\/$/, '');
  }

  private resolveIdempotencyKey(mailboxEmail: string): string {
    const digest = crypto
      .createHash('sha256')
      .update(mailboxEmail.trim().toLowerCase())
      .digest('hex')
      .slice(0, 32);
    return `mailbox-provision:${digest}`;
  }

  private resolveAuthHeaders(adminToken: string | undefined): {
    authorization?: string;
    'x-api-key'?: string;
  } {
    const token = String(adminToken || '').trim();
    if (!token) return {};
    const tokenHeader = String(
      process.env.MAILZEN_MAIL_ADMIN_API_TOKEN_HEADER || 'authorization',
    )
      .trim()
      .toLowerCase();
    if (tokenHeader === 'x-api-key') {
      return {
        'x-api-key': token,
      };
    }
    return {
      authorization: `Bearer ${token}`,
    };
  }

  private buildProvisionEndpoint(input: {
    provider: 'GENERIC' | 'MAILCOW' | 'MAILU';
    baseUrl: string;
  }): string {
    if (input.provider === 'MAILCOW') {
      return `${input.baseUrl}/api/v1/add/mailbox`;
    }
    if (input.provider === 'MAILU') {
      return `${input.baseUrl}/api/v1/mailboxes`;
    }
    return `${input.baseUrl}/mailboxes`;
  }

  private buildProvisionPayload(input: {
    provider: 'GENERIC' | 'MAILCOW' | 'MAILU';
    mailboxEmail: string;
    localPart: string;
    domain: string;
    generatedPassword: string;
    quotaLimitMb?: number | null;
  }): Record<string, unknown> {
    if (input.provider === 'MAILCOW') {
      return {
        local_part: input.localPart,
        domain: input.domain,
        name: input.localPart,
        quota: this.resolveMailcowQuotaMb(input.quotaLimitMb),
        active: '1',
        password: input.generatedPassword,
        password2: input.generatedPassword,
      };
    }
    if (input.provider === 'MAILU') {
      return {
        localpart: input.localPart,
        domain: input.domain,
        password: input.generatedPassword,
        enabled: true,
      };
    }
    return {
      email: input.mailboxEmail,
      localPart: input.localPart,
      domain: input.domain,
      password: input.generatedPassword,
    };
  }

  private isAlreadyProvisionedError(error: unknown): boolean {
    if (!axios.isAxiosError(error)) return false;
    const status = Number(error.response?.status || 0);
    if (status === 409) return true;
    if (status !== 400 && status !== 422) return false;

    const data = JSON.stringify(error.response?.data || '').toLowerCase();
    return (
      data.includes('already exists') ||
      data.includes('mailbox exists') ||
      data.includes('duplicate')
    );
  }

  private isRetryableProvisioningError(error: unknown): boolean {
    if (!axios.isAxiosError(error)) return false;
    const status = Number(error.response?.status || 0);
    if (status === 429) return true;
    if (status >= 500 && status <= 599) return true;
    const errorCode = String(error.code || '')
      .trim()
      .toUpperCase();
    return (
      errorCode === 'ECONNABORTED' ||
      errorCode === 'ECONNRESET' ||
      errorCode === 'ETIMEDOUT' ||
      errorCode === 'EAI_AGAIN'
    );
  }

  private describeProvisioningError(error: unknown): string {
    if (axios.isAxiosError(error)) {
      const status = Number(error.response?.status || 0);
      const code = String(error.code || '').trim();
      const dataSnippet = JSON.stringify(error.response?.data || '')
        .slice(0, 160)
        .replace(/\s+/g, ' ');
      const message = String(error.message || 'axios error').trim();
      const parts = [
        message,
        status ? `status=${status}` : null,
        code ? `code=${code}` : null,
        dataSnippet ? `data=${dataSnippet}` : null,
      ].filter(Boolean);
      return parts.join(' ');
    }
    if (error instanceof Error) return error.message;
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }

  private async provisionMailboxOnExternalServer(input: {
    mailboxEmail: string;
    localPart: string;
    domain: string;
    generatedPassword: string;
    quotaLimitMb?: number | null;
  }): Promise<void> {
    const adminApiUrl = process.env.MAILZEN_MAIL_ADMIN_API_URL?.trim();
    if (!adminApiUrl) {
      this.logger.warn(
        'MAILZEN_MAIL_ADMIN_API_URL not configured; skipping external mailbox API provisioning',
      );
      return;
    }

    const provider = this.resolveMailAdminProvider();
    const timeoutMs = this.getAdminApiTimeoutMs();
    const maxRetries = this.getAdminApiRetries();
    const backoffMs = this.getAdminApiBackoffMs();
    const maxJitterMs = this.getAdminApiJitterMs();
    const adminToken = process.env.MAILZEN_MAIL_ADMIN_API_TOKEN?.trim();
    const normalizedBaseUrl = this.normalizeAdminApiBaseUrl(adminApiUrl);
    const endpoint = this.buildProvisionEndpoint({
      provider,
      baseUrl: normalizedBaseUrl,
    });
    const payload = this.buildProvisionPayload({
      provider,
      mailboxEmail: input.mailboxEmail,
      localPart: input.localPart,
      domain: input.domain,
      generatedPassword: input.generatedPassword,
      quotaLimitMb: input.quotaLimitMb,
    });
    const headers = {
      'content-type': 'application/json',
      'x-idempotency-key': this.resolveIdempotencyKey(input.mailboxEmail),
      'x-mailzen-mailbox-email': input.mailboxEmail,
      ...this.resolveAuthHeaders(adminToken),
    };

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      try {
        await axios.post(endpoint, payload, {
          timeout: timeoutMs,
          headers,
        });
        this.logger.log(
          `External mailbox API provisioning succeeded for ${input.mailboxEmail} provider=${provider} attempts=${attempt + 1}`,
        );
        return;
      } catch (error: unknown) {
        if (this.isAlreadyProvisionedError(error)) {
          this.logger.warn(
            `External mailbox already provisioned for ${input.mailboxEmail}; treating as idempotent success`,
          );
          return;
        }
        const errorMessage = this.describeProvisioningError(error);
        const isRetryable = this.isRetryableProvisioningError(error);
        const isLastAttempt = attempt >= maxRetries;

        if (!isRetryable || isLastAttempt) {
          this.logger.error(
            `External mailbox API provisioning failed for ${input.mailboxEmail} provider=${provider} attempts=${attempt + 1}: ${errorMessage}`,
          );
          throw new InternalServerErrorException(
            'Mailbox provisioning failed on external mail server',
          );
        }

        const jitterMs =
          maxJitterMs > 0 ? Math.floor(Math.random() * (maxJitterMs + 1)) : 0;
        const waitMs = backoffMs * (attempt + 1) + jitterMs;
        this.logger.warn(
          `External mailbox provisioning retry for ${input.mailboxEmail} provider=${provider} attempt=${attempt + 1} waitMs=${waitMs} error=${errorMessage}`,
        );
        await this.sleep(waitMs);
      }
    }
  }

  private buildDeprovisionEndpoint(input: {
    provider: 'GENERIC' | 'MAILCOW' | 'MAILU';
    baseUrl: string;
    mailboxEmail: string;
  }): { method: 'delete' | 'post'; url: string; payload?: unknown } {
    if (input.provider === 'MAILCOW') {
      return {
        method: 'post',
        url: `${input.baseUrl}/api/v1/delete/mailbox`,
        payload: {
          items: [input.mailboxEmail],
        },
      };
    }
    if (input.provider === 'MAILU') {
      return {
        method: 'delete',
        url: `${input.baseUrl}/api/v1/mailboxes/${encodeURIComponent(input.mailboxEmail)}`,
      };
    }
    return {
      method: 'delete',
      url: `${input.baseUrl}/mailboxes/${encodeURIComponent(input.mailboxEmail)}`,
    };
  }

  private async attemptExternalRollback(input: { mailboxEmail: string }) {
    const adminApiUrl = process.env.MAILZEN_MAIL_ADMIN_API_URL?.trim();
    if (!adminApiUrl) return;

    const provider = this.resolveMailAdminProvider();
    const timeoutMs = this.getAdminApiTimeoutMs();
    const adminToken = process.env.MAILZEN_MAIL_ADMIN_API_TOKEN?.trim();
    const normalizedBaseUrl = this.normalizeAdminApiBaseUrl(adminApiUrl);
    const deprovisionRequest = this.buildDeprovisionEndpoint({
      provider,
      baseUrl: normalizedBaseUrl,
      mailboxEmail: input.mailboxEmail,
    });
    const headers = {
      'content-type': 'application/json',
      'x-mailzen-mailbox-email': input.mailboxEmail,
      ...this.resolveAuthHeaders(adminToken),
    };

    try {
      if (deprovisionRequest.method === 'post') {
        await axios.post(deprovisionRequest.url, deprovisionRequest.payload, {
          timeout: timeoutMs,
          headers,
        });
      } else {
        await axios.delete(deprovisionRequest.url, {
          timeout: timeoutMs,
          headers,
        });
      }
      this.logger.warn(
        `External mailbox rollback succeeded for ${input.mailboxEmail}`,
      );
    } catch (error: unknown) {
      const message = this.describeProvisioningError(error);
      this.logger.warn(
        `External mailbox rollback failed for ${input.mailboxEmail}: ${message}`,
      );
    }
  }

  // Provision a mailbox on a self-hosted stack and store encrypted IMAP/SMTP credentials.
  async provisionMailbox(
    userId: string,
    localPart: string,
    quotaLimitMb?: number,
  ): Promise<void> {
    const password = crypto.randomBytes(16).toString('base64url');
    const mailboxEmail = `${localPart}@${MailServerService.MAILZEN_DOMAIN}`;

    await this.provisionMailboxOnExternalServer({
      mailboxEmail,
      localPart,
      domain: MailServerService.MAILZEN_DOMAIN,
      generatedPassword: password,
      quotaLimitMb,
    });

    const encryptedPassword = encryptProviderSecret(
      password,
      this.providerSecretsKeyring,
    );
    const connectionConfig = this.getConnectionConfig();

    const updateResult = await this.mailboxRepo.update(
      { userId, localPart, domain: MailServerService.MAILZEN_DOMAIN },
      {
        username: mailboxEmail,
        passwordEnc: encryptedPassword,
        passwordIv: undefined,
        smtpHost: connectionConfig.smtpHost,
        smtpPort: connectionConfig.smtpPort,
        imapHost: connectionConfig.imapHost,
        imapPort: connectionConfig.imapPort,
      },
    );

    if (!updateResult.affected) {
      this.logger.error(
        `Mailbox credential persistence failed for ${mailboxEmail}; mailbox row not found`,
      );
      await this.attemptExternalRollback({ mailboxEmail });
      throw new InternalServerErrorException(
        'Mailbox credentials could not be persisted',
      );
    }

    this.logger.log(`Provisioned mailbox ${mailboxEmail}`);
  }
}
