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

function encryptSecret(
  plaintext: string,
  key: Buffer,
): { iv: string; ciphertext: string } {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString('base64'),
    ciphertext: Buffer.concat([enc, tag]).toString('base64'),
  };
}

@Injectable()
export class MailServerService {
  private readonly logger = new Logger(MailServerService.name);

  constructor(
    @InjectRepository(Mailbox)
    private readonly mailboxRepo: Repository<Mailbox>,
  ) {}

  private resolveEncryptionKey(): Buffer {
    const raw = process.env.SECRETS_KEY?.trim();
    if (raw && raw.length >= 32) {
      return Buffer.from(raw.slice(0, 32));
    }

    const env = (process.env.NODE_ENV || 'development').toLowerCase();
    if (env === 'production') {
      throw new InternalServerErrorException(
        'SECRETS_KEY must be configured with at least 32 characters',
      );
    }

    // Local-only fallback key (never used in production).
    this.logger.warn(
      'SECRETS_KEY missing/short; using development fallback key for mailbox credential encryption',
    );
    return Buffer.from('mailzen-local-dev-secrets-key-32b'.slice(0, 32));
  }

  private getConnectionConfig() {
    return {
      smtpHost: process.env.MAILZEN_SMTP_HOST || 'smtp.mailzen.local',
      smtpPort: parseInt(process.env.MAILZEN_SMTP_PORT || '587', 10),
      imapHost: process.env.MAILZEN_IMAP_HOST || 'imap.mailzen.local',
      imapPort: parseInt(process.env.MAILZEN_IMAP_PORT || '993', 10),
    };
  }

  private async provisionMailboxOnExternalServer(input: {
    mailboxEmail: string;
    generatedPassword: string;
  }): Promise<void> {
    const adminApiUrl = process.env.MAILZEN_MAIL_ADMIN_API_URL?.trim();
    if (!adminApiUrl) {
      this.logger.warn(
        'MAILZEN_MAIL_ADMIN_API_URL not configured; skipping external mailbox API provisioning',
      );
      return;
    }

    const timeoutMs = parseInt(
      process.env.MAILZEN_MAIL_ADMIN_API_TIMEOUT_MS || '5000',
      10,
    );
    const adminToken = process.env.MAILZEN_MAIL_ADMIN_API_TOKEN?.trim();
    const endpoint = `${adminApiUrl.replace(/\/$/, '')}/mailboxes`;

    try {
      await axios.post(
        endpoint,
        {
          email: input.mailboxEmail,
          password: input.generatedPassword,
        },
        {
          timeout:
            Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 5000,
          headers: {
            'content-type': 'application/json',
            ...(adminToken ? { authorization: `Bearer ${adminToken}` } : {}),
          },
        },
      );

      this.logger.log(
        `External mailbox API provisioning succeeded for ${input.mailboxEmail}`,
      );
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `External mailbox API provisioning failed for ${input.mailboxEmail}: ${errorMessage}`,
      );
      throw new InternalServerErrorException(
        'Mailbox provisioning failed on external mail server',
      );
    }
  }

  // Provision a mailbox on a self-hosted stack and store encrypted IMAP/SMTP credentials.
  async provisionMailbox(userId: string, localPart: string): Promise<void> {
    const password = crypto.randomBytes(16).toString('base64url');
    const mailboxEmail = `${localPart}@mailzen.com`;

    await this.provisionMailboxOnExternalServer({
      mailboxEmail,
      generatedPassword: password,
    });

    const key = this.resolveEncryptionKey();
    const { iv, ciphertext } = encryptSecret(password, key);
    const connectionConfig = this.getConnectionConfig();

    const updateResult = await this.mailboxRepo.update(
      { userId, localPart, domain: 'mailzen.com' },
      {
        username: mailboxEmail,
        passwordEnc: ciphertext,
        passwordIv: iv,
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
      throw new InternalServerErrorException(
        'Mailbox credentials could not be persisted',
      );
    }

    this.logger.log(`Provisioned mailbox ${mailboxEmail}`);
  }
}
