/**
 * File:        core/domain/bounded-contexts/notifications/notification.aggregate.ts
 * Module:      Domain - Notifications Bounded Context
 * Purpose:     In-app notification aggregate.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { AggregateRoot } from '../../shared/aggregate-root';
import { Result } from '../../shared/result';

export type NotificationType =
  | 'email.received'
  | 'email.bounced'
  | 'automation.failed'
  | 'subscription.expiring'
  | 'mention'
  | 'system';

export interface NotificationProps {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  payload: Record<string, unknown>;
  readAt: Date | null;
  createdAt: Date;
}

export class Notification extends AggregateRoot<NotificationProps> {
  get id(): string { return this.props.id; }
  get userId(): string { return this.props.userId; }
  get type(): NotificationType { return this.props.type; }
  get title(): string { return this.props.title; }
  get body(): string { return this.props.body; }
  get payload(): Record<string, unknown> { return this.props.payload; }
  get readAt(): Date | null { return this.props.readAt; }
  get isUnread(): boolean { return this.props.readAt === null; }

  private constructor(props: NotificationProps) {
    super(props);
  }

  static create(input: {
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    payload?: Record<string, unknown>;
  }): Result<Notification, Error> {
    if (!input.userId) return Result.err(new Error('userId is required'));
    if (!input.title?.trim()) return Result.err(new Error('Title is required'));
    return Result.ok(new Notification({
      id: crypto.randomUUID(),
      userId: input.userId,
      type: input.type,
      title: input.title.trim(),
      body: input.body ?? '',
      payload: input.payload ?? {},
      readAt: null,
      createdAt: new Date(),
    }));
  }

  static reconstitute(props: NotificationProps): Notification {
    return new Notification(props);
  }

  markRead(): Notification {
    if (this.props.readAt !== null) return this;
    return new Notification({ ...this.props, readAt: new Date() });
  }
}
