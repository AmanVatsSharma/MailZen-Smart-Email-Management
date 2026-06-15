/**
 * File:        apps/backend/src/core/domain/bounded-contexts/mailbox/value-objects/email-credentials.ts
 * Module:      Mailbox · Value Object
 * Purpose:     Opaque VO for encrypted email provider credentials. Stores
 *              encrypted + IV values from `provider-secrets` module. Never
 *              exposed through domain APIs.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { AggregateRoot } from '../../../shared/aggregate-root';
import { Result, makeResult } from '../../../shared/result';

export interface EmailCredentialsProps {
  encryptedData: string;
  iv: string;
  createdAt: Date;
}

export class EmailCredentials extends AggregateRoot<EmailCredentialsProps> {
  private constructor(props: EmailCredentialsProps) {
    super(props);
  }

  static create(encryptedData: string, iv: string): Result<EmailCredentials, InvalidCredentialsError> {
    if (!encryptedData || !iv) {
      return makeResult(Result.err(new InvalidCredentialsError('Missing encrypted data or IV')));
    }

    return makeResult(Result.ok(new EmailCredentials({
      encryptedData,
      iv,
      createdAt: new Date(),
    })));
  }

  static unsafeCreate(encryptedData: string, iv: string): EmailCredentials {
    return EmailCredentials.create(encryptedData, iv).unwrap();
  }

  get encryptedData(): string {
    return this.props.encryptedData;
  }

  get iv(): string {
    return this.props.iv;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  equals(other: EmailCredentials): boolean {
    return this.props.encryptedData === other.props.encryptedData &&
           this.props.iv === other.props.iv;
  }
}

export class InvalidCredentialsError extends Error {
  readonly kind = 'InvalidCredentialsError' as const;
  constructor(message: string) {
    super(message);
    this.name = 'InvalidCredentialsError';
  }
}