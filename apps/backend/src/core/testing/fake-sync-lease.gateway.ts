/**
 * File:        apps/backend/src/core/testing/fake-sync-lease.gateway.ts
 * Module:      Testing · Fake
 * Purpose:     Fake ISyncLeaseGateway for unit tests. Tracks leases
 *              in memory; supports TTL expiry for race-condition tests.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { ISyncLeaseGateway, SyncLease, SyncLeaseResponse } from '../application/ports/gateways/sync-lease.gateway';

export class FakeSyncLeaseGateway implements ISyncLeaseGateway {
  private leases: Map<string, { mailboxId: string; expiresAt: Date; userId: string; heartbeatCount: number }> = new Map();
  private nextId = 0;
  private failAcquire = false;

  setFailAcquire(fail: boolean): void {
    this.failAcquire = fail;
  }

  async acquire(mailboxId: string, ttl: number, userId: string): Promise<SyncLeaseResponse> {
    if (this.failAcquire) {
      return { success: false };
    }

    for (const lease of this.leases.values()) {
      if (lease.mailboxId === mailboxId && lease.expiresAt.getTime() > Date.now()) {
        return { success: false };
      }
    }

    const leaseId = `lease-${++this.nextId}`;
    const expiresAt = new Date(Date.now() + ttl);
    this.leases.set(leaseId, { mailboxId, expiresAt, userId, heartbeatCount: 0 });

    return { success: true, leaseId };
  }

  async renew(leaseId: string, ttl: number): Promise<SyncLeaseResponse> {
    const lease = this.leases.get(leaseId);
    if (!lease || lease.expiresAt.getTime() <= Date.now()) {
      return { success: false };
    }

    lease.expiresAt = new Date(Date.now() + ttl);
    lease.heartbeatCount += 1;
    return { success: true, leaseId };
  }

  async release(leaseId: string): Promise<boolean> {
    return this.leases.delete(leaseId);
  }

  async isValid(leaseId: string): Promise<boolean> {
    const lease = this.leases.get(leaseId);
    return !!lease && lease.expiresAt.getTime() > Date.now();
  }

  async getLease(mailboxId: string): Promise<SyncLease | null> {
    for (const [id, lease] of this.leases.entries()) {
      if (lease.mailboxId === mailboxId && lease.expiresAt.getTime() > Date.now()) {
        return {
          id,
          mailboxId: lease.mailboxId,
          expiresAt: lease.expiresAt,
          heartbeatCount: lease.heartbeatCount,
        };
      }
    }
    return null;
  }

  reset(): void {
    this.leases.clear();
    this.nextId = 0;
    this.failAcquire = false;
  }
}
