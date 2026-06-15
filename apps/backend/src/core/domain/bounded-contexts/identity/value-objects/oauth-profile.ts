/**
 * File:        core/domain/bounded-contexts/identity/value-objects/oauth-profile.ts
 * Module:      Domain - Identity Bounded Context
 * Purpose:     OAuth provider profile value object with provider enum
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Result, makeResult } from '../../../shared/result';

export enum OAuthProvider {
  GOOGLE = 'google',
  MICROSOFT = 'microsoft'
}

export interface OAuthProfileProps {
  provider: OAuthProvider;
  providerUserId: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
}

export class OAuthProfile {
  private constructor(private readonly props: OAuthProfileProps) {}

  static create(props: OAuthProfileProps): Result<OAuthProfile, InvalidOAuthProfileError> {
    if (!props.provider || !props.providerUserId || !props.email) {
      return Result.err(new InvalidOAuthProfileError('Provider, providerUserId, and email are required'));
    }

    if (!Object.values(OAuthProvider).includes(props.provider)) {
      return Result.err(new InvalidOAuthProfileError(`Invalid provider: ${props.provider}`));
    }

    return Result.ok(new OAuthProfile({
      provider: props.provider,
      providerUserId: props.providerUserId,
      email: props.email.toLowerCase().trim(),
      displayName: props.displayName?.trim(),
      avatarUrl: props.avatarUrl?.trim()
    }));
  }

  get provider(): OAuthProvider {
    return this.props.provider;
  }

  get providerUserId(): string {
    return this.props.providerUserId;
  }

  get email(): string {
    return this.props.email;
  }

  get displayName(): string | undefined {
    return this.props.displayName;
  }

  get avatarUrl(): string | undefined {
    return this.props.avatarUrl;
  }

  equals(other: OAuthProfile): boolean {
    return this.props.provider === other.props.provider &&
           this.props.providerUserId === other.props.providerUserId;
  }
}

export class InvalidOAuthProfileError extends Error {
  readonly kind = 'InvalidOAuthProfileError' as const;
  constructor(message: string) {
    super(message);
    this.name = 'InvalidOAuthProfileError';
  }
}