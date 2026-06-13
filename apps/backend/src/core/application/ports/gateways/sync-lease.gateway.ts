/**
 * File:        apps/backend/src/core/application/ports/gateways/sync-lease.gateway.ts
 * Module:      Application · Port
 * Purpose:     Sync lease gateway port. Distributed locking for mailbox sync
 *              to prevent duplicate syncs. Hides Redis/DistributedService
 *              implementation.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

export interface SyncLease {
  id: string;
  mailboxId: string;
  expiresAt: Date;
  heartbeatCount: number;
}

export interface SyncLeaseResponse {
  success: boolean;
  leaseId?: string;
  remaining?: number;
}

export interface ISyncLeaseGateway {
  acquire(
    mailboxId: string,
    ttl: number,
    userId: string,
  ): Promise<SyncLeaseResponse>;

  renew(
    leaseId: string,
    ttl: number,
  ): Promise<SyncLeaseResponse>;

  release(
    leaseId: string,
  ): Promise<boolean>;

  isValid(
    leaseId: string,
  ): Promise<boolean>;

  getLease(mailboxId: string): Promise<SyncLease | null>;
}

export const SYNC_LEASE_GATEWAY = Symbol('ISyncLeaseGateway');
