/**
 * File:        core/application/ports/repositories/label.repository.ts
 * Module:      Application - Organization (Labels) Bounded Context
 * Purpose:     Port for label persistence.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Label } from '../../../domain/bounded-contexts/organization/label.aggregate';
import { Result } from '../../../domain/shared/result';
import { WorkspaceId } from '../../../domain/shared/value-objects/ids';

export const LABEL_REPOSITORY = Symbol('ILabelRepository');

export interface ILabelRepository {
  save(label: Label): Promise<Result<void, Error>>;
  findById(id: string): Promise<Label | null>;
  listByWorkspace(workspaceId: WorkspaceId): Promise<Label[]>;
  delete(id: string): Promise<Result<void, Error>>;
}
