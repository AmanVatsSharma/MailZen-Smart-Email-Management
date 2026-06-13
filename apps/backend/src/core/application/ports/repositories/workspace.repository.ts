/**
 * File:        apps/backend/src/core/application/ports/repositories/workspace.repository.ts
 * Module:      Application Ports
 * Purpose:     Port for persisting Workspace aggregate
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Workspace } from '../../../domain/bounded-contexts/workspaces/workspace.aggregate';
import { Result } from '../../../domain/shared/result';

export const WORKSPACE_REPOSITORY = Symbol('IWorkspaceRepository');

export interface IWorkspaceRepository {
  save(workspace: Workspace): Promise<Result<void, Error>>;
  findById(id: string): Promise<Workspace | null>;
  findBySlug(slug: string): Promise<Workspace | null>;
  findByOwnerId(ownerUserId: string): Promise<Workspace[]>;
  findByOwnerAndSlug(ownerUserId: string, slug: string): Promise<Workspace | null>;
  delete(id: string): Promise<Result<void, Error>>;
  existsWithSlug(slug: string): Promise<boolean>;
}