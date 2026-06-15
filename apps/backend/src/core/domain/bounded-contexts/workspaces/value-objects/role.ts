/**
 * File:        apps/backend/src/core/domain/bounded-contexts/workspaces/value-objects/role.ts
 * Module:      Workspace Domain
 * Purpose:     Role enum and permission checks
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Result } from '../../../shared/result';

export enum Role {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
  GUEST = 'GUEST',
}

const VALID_ROLES: Set<Role> = new Set([Role.OWNER, Role.ADMIN, Role.MEMBER, Role.GUEST]);

export function isValidRole(value: string): value is Role {
  return VALID_ROLES.has(value as Role);
}

export function parseRole(value: string): Result<Role> {
  const normalized = value?.trim().toUpperCase();
  if (!isValidRole(normalized)) {
    return Result.err(new Error(`Invalid role: ${value}. Must be one of: ${Array.from(VALID_ROLES).join(', ')}`));
  }
  return Result.ok(normalized);
}

export const PERMISSIONS = {
  canManageBilling(role: Role): boolean {
    return role === Role.OWNER || role === Role.ADMIN;
  },

  canManageMembers(role: Role): boolean {
    return role === Role.OWNER || role === Role.ADMIN;
  },

  canSendEmail(role: Role): boolean {
    return role === Role.OWNER || role === Role.ADMIN || role === Role.MEMBER;
  },

  canViewBilling(role: Role): boolean {
    return role === Role.OWNER || role === Role.ADMIN;
  },

  canManageIntegrations(role: Role): boolean {
    return role === Role.OWNER || role === Role.ADMIN;
  },

  canManageAutomations(role: Role): boolean {
    return role === Role.OWNER || role === Role.ADMIN;
  },

  canDeleteWorkspace(role: Role): boolean {
    return role === Role.OWNER;
  },

  canTransferOwnership(role: Role): boolean {
    return role === Role.OWNER;
  },

  canExportData(role: Role): boolean {
    return role === Role.OWNER || role === Role.ADMIN || role === Role.MEMBER;
  },
};

export class RoleValueObject {
  constructor(public readonly value: Role) {
    if (!isValidRole(value)) {
      throw new Error(`Invalid role: ${value}`);
    }
  }

  canManageBilling(): boolean {
    return PERMISSIONS.canManageBilling(this.value);
  }

  canManageMembers(): boolean {
    return PERMISSIONS.canManageMembers(this.value);
  }

  canSendEmail(): boolean {
    return PERMISSIONS.canSendEmail(this.value);
  }

  canManageAutomations(): boolean {
    return PERMISSIONS.canManageAutomations(this.value);
  }

  canTransferOwnership(): boolean {
    return PERMISSIONS.canTransferOwnership(this.value);
  }

  equals(other: Role): boolean {
    return this.value === other;
  }
}