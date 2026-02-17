import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import axios from 'axios';
import { AuditLog } from '../auth/entities/audit-log.entity';
import { Mailbox } from './entities/mailbox.entity';
import {
  encryptProviderSecret,
  ProviderSecretsKeyring,
  resolveProviderSecretsKeyring,
} from '../common/provider-secrets.util';
import {
  fingerprintIdentifier,
  serializeStructuredLog,
} from '../common/logging/structured-log.util';

export interface MailboxProvisioningHealthSnapshot {
  provider: string;
  provisioningRequired: boolean;
  adminApiConfigured: boolean;
  configuredEndpointCount: number;
  configuredEndpoints: string[];
  failoverEnabled: boolean;
  requestTimeoutMs: number;
  maxRetries: number;
  retryBackoffMs: number;
  retryJitterMs: number;
  mailcowQuotaDefaultMb: number;
  evaluatedAtIso: string;
}

@Injectable()
export class MailServerService {
  private readonly logger = new Logger(MailServerService.name);
  private readonly providerSecretsKeyring: ProviderSecretsKeyring;

  private static readonly MAILZEN_DOMAIN = 'mailzen.com';

  constructor(
    @InjectRepository(Mailbox)
    private readonly mailboxRepo: Repository<Mailbox>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepo?: Repository<AuditLog>,
  ) {
    try {
      this.providerSecretsKeyring = resolveProviderSecretsKeyring();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        serializeStructuredLog({
          event: 'mailbox_keyring_resolve_failed',
          error: message,
        }),
      );
      throw new InternalServerErrorException(
        'Mailbox credential encryption keyring is misconfigured',
      );
    }
  }

  private async writeAuditLog(input: {
    userId: string;
    action: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    if (!this.auditLogRepo) return;
    try {
      const auditEntry = this.auditLogRepo.create({
        userId: input.userId,
        action: input.action,
        metadata: input.metadata,
      });
      await this.auditLogRepo.save(auditEntry);
    } catch (error) {
      this.logger.warn(
        serializeStructuredLog({
          event: 'mail_server_audit_log_write_failed',
          userId: input.userId,
          action: input.action,
          error: String(error),
        }),
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
      serializeStructuredLog({
        event: 'mailbox_admin_provider_unknown',
        rawProvider,
        fallbackProvider: 'GENERIC',
      }),
    );
    return 'GENERIC';
  }

  private fingerprintMailbox(mailboxEmail: string): string {
    return fingerprintIdentifier(mailboxEmail);
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

  private isExternalProvisioningRequired(): boolean {
    const strictByDefault =
      (process.env.NODE_ENV || 'development') === 'production';
    const normalized = String(
      process.env.MAILZEN_MAIL_ADMIN_REQUIRED ?? String(strictByDefault),
    )
      .trim()
      .toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off'].includes(normalized)) return false;
    return strictByDefault;
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
    return rawUrl.trim().replace(/\/+$/, '');
  }

  private resolveAdminApiBaseUrls(): string[] {
    const envList = String(process.env.MAILZEN_MAIL_ADMIN_API_URLS || '')
      .split(',')
      .map((value) => this.normalizeAdminApiBaseUrl(value))
      .filter(Boolean);
    if (envList.length > 0) {
      return Array.from(new Set(envList));
    }
    const singleUrl = this.normalizeAdminApiBaseUrl(
      process.env.MAILZEN_MAIL_ADMIN_API_URL || '',
    );
    if (!singleUrl) return [];
    return [singleUrl];
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
    const adminApiBaseUrls = this.resolveAdminApiBaseUrls();
    if (!adminApiBaseUrls.length) {
      if (this.isExternalProvisioningRequired()) {
        this.logger.error(
          serializeStructuredLog({
            event: 'mailbox_external_provisioning_config_missing_required',
            mailboxFingerprint: this.fingerprintMailbox(input.mailboxEmail),
            provisioningRequired: true,
          }),
        );
        throw new InternalServerErrorException(
          'External mailbox provisioning endpoint is required but not configured',
        );
      }
      this.logger.warn(
        serializeStructuredLog({
          event: 'mailbox_external_provisioning_config_missing_optional',
          mailboxFingerprint: this.fingerprintMailbox(input.mailboxEmail),
          provisioningRequired: false,
        }),
      );
      return;
    }

    const provider = this.resolveMailAdminProvider();
    const timeoutMs = this.getAdminApiTimeoutMs();
    const maxRetries = this.getAdminApiRetries();
    const backoffMs = this.getAdminApiBackoffMs();
    const maxJitterMs = this.getAdminApiJitterMs();
    const adminToken = process.env.MAILZEN_MAIL_ADMIN_API_TOKEN?.trim();
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
      for (
        let endpointIndex = 0;
        endpointIndex < adminApiBaseUrls.length;
        endpointIndex += 1
      ) {
        const baseUrl = adminApiBaseUrls[endpointIndex];
        const endpoint = this.buildProvisionEndpoint({
          provider,
          baseUrl,
        });
        const isLastEndpoint = endpointIndex >= adminApiBaseUrls.length - 1;
        try {
          await axios.post(endpoint, payload, {
            timeout: timeoutMs,
            headers,
          });
          this.logger.log(
            serializeStructuredLog({
              event: 'mailbox_external_provisioning_succeeded',
              mailboxFingerprint: this.fingerprintMailbox(input.mailboxEmail),
              provider,
              endpoint: baseUrl,
              attemptNumber: attempt + 1,
              maxRetries,
            }),
          );
          return;
        } catch (error: unknown) {
          if (this.isAlreadyProvisionedError(error)) {
            this.logger.warn(
              serializeStructuredLog({
                event: 'mailbox_external_provisioning_already_exists',
                mailboxFingerprint: this.fingerprintMailbox(input.mailboxEmail),
                provider,
                endpoint: baseUrl,
              }),
            );
            return;
          }
          const errorMessage = this.describeProvisioningError(error);
          const isRetryable = this.isRetryableProvisioningError(error);
          const isLastAttempt = attempt >= maxRetries;

          if (!isRetryable || (isLastAttempt && isLastEndpoint)) {
            this.logger.error(
              serializeStructuredLog({
                event: 'mailbox_external_provisioning_failed_terminal',
                mailboxFingerprint: this.fingerprintMailbox(input.mailboxEmail),
                provider,
                endpoint: baseUrl,
                attemptNumber: attempt + 1,
                maxRetries,
                retryable: isRetryable,
                error: errorMessage,
              }),
            );
            throw new InternalServerErrorException(
              'Mailbox provisioning failed on external mail server',
            );
          }

          if (!isLastEndpoint) {
            this.logger.warn(
              serializeStructuredLog({
                event: 'mailbox_external_provisioning_failover',
                mailboxFingerprint: this.fingerprintMailbox(input.mailboxEmail),
                provider,
                fromEndpoint: baseUrl,
                toEndpoint: adminApiBaseUrls[endpointIndex + 1],
                attemptNumber: attempt + 1,
                error: errorMessage,
              }),
            );
            continue;
          }

          const jitterMs =
            maxJitterMs > 0 ? Math.floor(Math.random() * (maxJitterMs + 1)) : 0;
          const waitMs = backoffMs * (attempt + 1) + jitterMs;
          this.logger.warn(
            serializeStructuredLog({
              event: 'mailbox_external_provisioning_retry_scheduled',
              mailboxFingerprint: this.fingerprintMailbox(input.mailboxEmail),
              provider,
              endpoint: baseUrl,
              attemptNumber: attempt + 1,
              waitMs,
              error: errorMessage,
            }),
          );
          await this.sleep(waitMs);
        }
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
    const adminApiBaseUrls = this.resolveAdminApiBaseUrls();
    if (!adminApiBaseUrls.length) return;

    const provider = this.resolveMailAdminProvider();
    const timeoutMs = this.getAdminApiTimeoutMs();
    const adminToken = process.env.MAILZEN_MAIL_ADMIN_API_TOKEN?.trim();
    const headers = {
      'content-type': 'application/json',
      'x-mailzen-mailbox-email': input.mailboxEmail,
      ...this.resolveAuthHeaders(adminToken),
    };

    for (let index = 0; index < adminApiBaseUrls.length; index += 1) {
      const baseUrl = adminApiBaseUrls[index];
      const deprovisionRequest = this.buildDeprovisionEndpoint({
        provider,
        baseUrl,
        mailboxEmail: input.mailboxEmail,
      });
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
          serializeStructuredLog({
            event: 'mailbox_external_rollback_succeeded',
            mailboxFingerprint: this.fingerprintMailbox(input.mailboxEmail),
            endpoint: baseUrl,
            provider,
          }),
        );
        return;
      } catch (error: unknown) {
        const message = this.describeProvisioningError(error);
        this.logger.warn(
          serializeStructuredLog({
            event: 'mailbox_external_rollback_failed',
            mailboxFingerprint: this.fingerprintMailbox(input.mailboxEmail),
            endpoint: baseUrl,
            provider,
            error: message,
          }),
        );
      }
    }
  }

  getProvisioningHealthSnapshot(): MailboxProvisioningHealthSnapshot {
    const configuredEndpoints = this.resolveAdminApiBaseUrls();
    return {
      provider: this.resolveMailAdminProvider(),
      provisioningRequired: this.isExternalProvisioningRequired(),
      adminApiConfigured: configuredEndpoints.length > 0,
      configuredEndpointCount: configuredEndpoints.length,
      configuredEndpoints,
      failoverEnabled: configuredEndpoints.length > 1,
      requestTimeoutMs: this.getAdminApiTimeoutMs(),
      maxRetries: this.getAdminApiRetries(),
      retryBackoffMs: this.getAdminApiBackoffMs(),
      retryJitterMs: this.getAdminApiJitterMs(),
      mailcowQuotaDefaultMb: this.resolveMailcowQuotaMb(),
      evaluatedAtIso: new Date().toISOString(),
    };
  }

  // Provision a mailbox on a self-hosted stack and store encrypted IMAP/SMTP credentials.
  async provisionMailbox(
    userId: string,
    localPart: string,
    quotaLimitMb?: number,
  ): Promise<void> {
    const password = crypto.randomBytes(16).toString('base64url');
    const mailboxEmail = `${localPart}@${MailServerService.MAILZEN_DOMAIN}`;
    const mailboxFingerprint = this.fingerprintMailbox(mailboxEmail);
    await this.writeAuditLog({
      userId,
      action: 'mailbox_provisioning_requested',
      metadata: {
        mailboxFingerprint,
        localPart,
        domain: MailServerService.MAILZEN_DOMAIN,
        quotaLimitMb: quotaLimitMb ?? null,
      },
    });

    try {
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
          serializeStructuredLog({
            event: 'mailbox_credential_persistence_failed',
            mailboxFingerprint,
            userId,
            localPart,
            domain: MailServerService.MAILZEN_DOMAIN,
            reason: 'mailbox_row_not_found',
          }),
        );
        await this.attemptExternalRollback({ mailboxEmail });
        throw new InternalServerErrorException(
          'Mailbox credentials could not be persisted',
        );
      }

      this.logger.log(
        serializeStructuredLog({
          event: 'mailbox_provision_completed',
          mailboxFingerprint,
          userId,
          localPart,
          domain: MailServerService.MAILZEN_DOMAIN,
        }),
      );
      await this.writeAuditLog({
        userId,
        action: 'mailbox_provisioning_completed',
        metadata: {
          mailboxFingerprint,
          localPart,
          domain: MailServerService.MAILZEN_DOMAIN,
          quotaLimitMb: quotaLimitMb ?? null,
        },
      });
    } catch (error) {
      const reason =
        error instanceof Error ? error.message.slice(0, 300) : String(error);
      await this.writeAuditLog({
        userId,
        action: 'mailbox_provisioning_failed',
        metadata: {
          mailboxFingerprint,
          localPart,
          domain: MailServerService.MAILZEN_DOMAIN,
          reason,
        },
      });
      throw error;
    }
  }
}
