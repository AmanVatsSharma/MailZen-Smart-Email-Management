/**
 * File:        core/domain/bounded-contexts/organization/label.aggregate.ts
 * Module:      Domain - Organization (Labels) Bounded Context
 * Purpose:     Workspace-scoped label for email organization.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { AggregateRoot } from '../../shared/aggregate-root';
import { Result } from '../../shared/result';
import { WorkspaceId } from '../../shared/value-objects/ids';

export interface LabelProps {
  id: string;
  workspaceId: WorkspaceId;
  name: string;
  color: string; // hex
  parentId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class Label extends AggregateRoot<LabelProps> {
  get id(): string { return this.props.id; }
  get workspaceId(): WorkspaceId { return this.props.workspaceId; }
  get name(): string { return this.props.name; }
  get color(): string { return this.props.color; }
  get parentId(): string | null { return this.props.parentId; }

  private constructor(props: LabelProps) {
    super(props);
  }

  static create(input: {
    workspaceId: WorkspaceId;
    name: string;
    color?: string;
    parentId?: string | null;
  }): Result<Label, Error> {
    const name = input.name?.trim();
    if (!name) return Result.err(new Error('Label name is required'));
    if (name.length > 64) return Result.err(new Error('Label name too long'));
    const color = input.color ?? '#8b5cf6';
    if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
      return Result.err(new Error('color must be a hex code (e.g. #8b5cf6)'));
    }
    const now = new Date();
    return Result.ok(new Label({
      id: crypto.randomUUID(),
      workspaceId: input.workspaceId,
      name,
      color,
      parentId: input.parentId ?? null,
      createdAt: now,
      updatedAt: now,
    }));
  }

  static reconstitute(props: LabelProps): Label {
    return new Label(props);
  }

  rename(newName: string): Result<Label, Error> {
    const n = newName?.trim();
    if (!n) return Result.err(new Error('Label name is required'));
    if (n.length > 64) return Result.err(new Error('Label name too long'));
    return Result.ok(new Label({
      ...this.props,
      name: n,
      updatedAt: new Date(),
    }));
  }
}
