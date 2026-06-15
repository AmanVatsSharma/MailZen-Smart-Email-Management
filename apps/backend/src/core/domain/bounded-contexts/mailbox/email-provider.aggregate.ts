/**
 * File:        apps/backend/src/core/domain/bounded-contexts/mailbox/email-provider.aggregate.ts
 * Module:      Mailbox · Aggregate
 * Purpose:     EmailProvider aggregate. Holds the encrypted OAuth tokens
 *              and provider metadata for a single connected mailbox. The
 *              mailbox and provider are separate aggregates: a mailbox
 *              can be deleted without losing the (rotated) provider keys.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { AggregateRoot } from '../../shared/aggregate-root';
import { DomainEvent } from '../../shared/domain-event';
import { EmailCredentials } from './value-objects/email-credentials';
import { ProviderType } from './value-objects/provider-type';

export interface EmailProviderProps {
  id: string;
  mailboxId: string;
  provider: ProviderType;
  credentials: EmailCredentials;
  scopes: string[];
  expiresAt: Date | null;
  refreshExpiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class EmailProviderTokensRefreshedEvent extends DomainEvent {
  readonly eventName = 'EmailProviderTokensRefreshed';
  constructor(
    public readonly providerId: string,
    public readonly mailboxId: string,
  ) {
    super({ occurredAt: new Date() });
  }
}

export class EmailProvider extends AggregateRoot<EmailProviderProps> {
  private constructor(props: EmailProviderProps) {
    super(props);
  }

  static create(input: {
    id: string;
    mailboxId: string;
    provider: ProviderType;
    credentials: EmailCredentials;
    scopes: string[];
    expiresAt: Date | null;
    refreshExpiresAt: Date | null;
  }): EmailProvider {
    const now = new Date();
    return new EmailProvider({
      id: input.id,
      mailboxId: input.mailboxId,
      provider: input.provider,
      credentials: input.credentials,
      scopes: input.scopes,
      expiresAt: input.expiresAt,
      refreshExpiresAt: input.refreshExpiresAt,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(props: EmailProviderProps): EmailProvider {
    return new EmailProvider(props);
  }

  get id(): string { return this.props.id; }
  get mailboxId(): string { return this.props.mailboxId; }
  get provider(): ProviderType { return this.props.provider; }
  get credentials(): EmailCredentials { return this.props.credentials; }
  get scopes(): ReadonlyArray<string> { return this.props.scopes; }
  get expiresAt(): Date | null { return this.props.expiresAt; }
  get refreshExpiresAt(): Date | null { return this.props.refreshExpiresAt; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }

  rotateCredentials(credentials: EmailCredentials, expiresAt: Date | null, refreshExpiresAt: Date | null): void {
    this.props.credentials = credentials;
    this.props.expiresAt = expiresAt;
    this.props.refreshExpiresAt = refreshExpiresAt;
    this.props.updatedAt = new Date();
    this.incrementVersion();
    this.addDomainEvent(new EmailProviderTokensRefreshedEvent(
      this.props.id,
      this.props.mailboxId,
    ));
  }

  isExpired(now: Date = new Date()): boolean {
    return this.props.expiresAt !== null && this.props.expiresAt.getTime() <= now.getTime();
  }
}
