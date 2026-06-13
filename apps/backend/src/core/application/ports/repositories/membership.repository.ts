/**
 * File:        apps/backend/src/core/application/ports/repositories/membership.repository.ts
 * Module:      Application Ports
 * Purpose:     Port for persisting Membership aggregate
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Membership } from '../../../domain/bounded-contexts/workspaces/membership.aggregate';
import { Role } from '../../../domain/bounded-contexts/workspaces/value-objects/role';
import { Result } from '../../../domain/shared/result';

export const MEMBERSHIP_REPOSITORY = Symbol('IMembershipRepository');

export interface IMembershipRepository {
  save(membership: Membership): Promise<Result<void, Error>>;
  findById(id: string): Promise<Membership | null>;
  findByWorkspaceId(workspaceId: string): Promise<Membership[]>;
  findByWorkspaceAndEmail(workspaceId: string, email: string): Promise<Membership | null>;
  findByUserId(userId: string): Promise<Membership[]>;
  findByEmail(email: string): Promise<Membership[]>;
  findOwnersByWorkspaceId(workspaceId: string): Promise<Membership[]>;
  countActiveByWorkspaceId(workspaceId: string): Promise<number>;
  delete(id: string): Promise<Result<void, Error>>;
}