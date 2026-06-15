/**
 * File:        core/domain/bounded-contexts/unified-inbox/unified-thread.aggregate.ts
 * Module:      Domain - Unified Inbox Bounded Context
 * Purpose:     A thread aggregated across multiple provider accounts (Gmail, Outlook, etc).
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { AggregateRoot } from '../../shared/aggregate-root';
import { Result } from '../../shared/result';
import { WorkspaceId, UserId } from '../../shared/value-objects/ids';

export type FolderKind = 'inbox' | 'sent' | 'drafts' | 'archive' | 'trash' | 'spam' | 'starred' | 'custom';

export interface InboxFolderProps {
  id: string;
  workspaceId: WorkspaceId;
  userId: UserId;
  name: string;
  kind: FolderKind;
  parentId: string | null;
  unreadCount: number;
  createdAt: Date;
}

export class InboxFolder extends AggregateRoot<InboxFolderProps> {
  get id(): string { return this.props.id; }
  get name(): string { return this.props.name; }
  get kind(): FolderKind { return this.props.kind; }

  private constructor(props: InboxFolderProps) {
    super(props);
  }

  static create(input: {
    workspaceId: WorkspaceId;
    userId: UserId;
    name: string;
    kind: FolderKind;
    parentId?: string | null;
  }): Result<InboxFolder, Error> {
    if (!input.name?.trim()) return Result.err(new Error('Folder name is required'));
    return Result.ok(new InboxFolder({
      id: crypto.randomUUID(),
      workspaceId: input.workspaceId,
      userId: input.userId,
      name: input.name.trim(),
      kind: input.kind,
      parentId: input.parentId ?? null,
      unreadCount: 0,
      createdAt: new Date(),
    }));
  }

  static reconstitute(props: InboxFolderProps): InboxFolder {
    return new InboxFolder(props);
  }
}

export interface UnifiedThreadProps {
  id: string;
  workspaceId: WorkspaceId;
  userId: UserId;
  subject: string;
  participants: string[];
  providerThreadIds: Record<string, string>; // provider -> threadId
  lastMessageAt: Date;
  messageCount: number;
  unread: boolean;
  starred: boolean;
  folderId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class UnifiedThread extends AggregateRoot<UnifiedThreadProps> {
  get id(): string { return this.props.id; }
  get subject(): string { return this.props.subject; }
  get lastMessageAt(): Date { return this.props.lastMessageAt; }
  get unread(): boolean { return this.props.unread; }
  get messageCount(): number { return this.props.messageCount; }

  private constructor(props: UnifiedThreadProps) {
    super(props);
  }

  static reconstitute(props: UnifiedThreadProps): UnifiedThread {
    return new UnifiedThread(props);
  }

  markRead(): UnifiedThread {
    if (!this.props.unread) return this;
    return new UnifiedThread({ ...this.props, unread: false, updatedAt: new Date() });
  }

  toggleStar(): UnifiedThread {
    return new UnifiedThread({ ...this.props, starred: !this.props.starred, updatedAt: new Date() });
  }
}
