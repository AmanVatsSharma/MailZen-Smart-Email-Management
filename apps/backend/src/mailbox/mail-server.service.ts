import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { Mailbox } from './entities/mailbox.entity';

function encryptSecret(plaintext: string): { iv: string; ciphertext: string } {
  const key = Buffer.from(
    (process.env.SECRETS_KEY || '').padEnd(32, '0').slice(0, 32),
  );
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

  // Provision a mailbox on a self-hosted stack (Mailu/Mailcow via API) and store IMAP/SMTP creds
  async provisionMailbox(userId: string, localPart: string): Promise<void> {
    // TODO: Call Mailu/Mailcow admin API to create the mailbox with password
    const password = crypto.randomBytes(16).toString('base64url');
    const { iv, ciphertext } = encryptSecret(password);

    // Example hostnames/ports (to be set from env)
    const smtpHost = process.env.MAILZEN_SMTP_HOST || 'smtp.mailzen.local';
    const smtpPort = parseInt(process.env.MAILZEN_SMTP_PORT || '587', 10);
    const imapHost = process.env.MAILZEN_IMAP_HOST || 'imap.mailzen.local';
    const imapPort = parseInt(process.env.MAILZEN_IMAP_PORT || '993', 10);

    await this.mailboxRepo.update(
      { userId, localPart, domain: 'mailzen.com' },
      {
        username: `${localPart}@mailzen.com`,
        passwordEnc: ciphertext,
        passwordIv: iv,
        smtpHost,
        smtpPort,
        imapHost,
        imapPort,
      },
    );
    this.logger.log(`Provisioned mailbox ${localPart}@mailzen.com`);
  }
}
