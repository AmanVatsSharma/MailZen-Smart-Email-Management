/**
 * File:        core/testing/index.ts
 * Module:      Testing
 * Purpose:     Barrel export for in-memory test fakes
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

// Identity related repositories
export * from './in-memory-user.repository';
export * from './in-memory-session.repository';

// Identity related gateways
export * from './fake-password-hasher';
export * from './fake-jwt.gateway';
export * from './fake-oauth.gateway';

// Core infrastructure fakes
export * from './fake-unit-of-work';
export * from './fake-event-bus';
export * from './fake-mail.gateway';

// Legacy repositories (pre-existing)
export * from './in-memory-attachment.repository';
export * from './in-memory-email.repository';
export * from './in-memory-email-assignment.repository';
export * from './in-memory-email-filter.repository';
export * from './in-memory-email-template.repository';
export * from './in-memory-email-warmup.repository';
export * from './in-memory-thread.repository';

// Mailbox bounded context
export * from './in-memory-mailbox.repository';
export * from './in-memory-email-provider.repository';

// AI bounded context
export * from './in-memory-smart-reply.repository';
export * from './in-memory-triage-result.repository';
export * from './in-memory-sender-profile.repository';
export * from './fake-ai.gateway';

// Provider gateways
export * from './fake-email-provider.gateway';
export * from './fake-pubsub.gateway';
export * from './fake-sync-lease.gateway';