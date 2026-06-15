/**
 * File:        apps/backend/src/core/domain/bounded-contexts/contacts/contact.aggregate.ts
 * Module:      Contacts Domain
 * Purpose:     Contact aggregate root with business logic
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { AggregateRoot } from '../../shared/aggregate-root';
import { DomainEvent } from '../../shared/domain-event';
import { Result, makeResult } from '../../shared/result';

export interface ContactProps {
  id: string;
  workspaceId: string;
  email: string;
  displayName: string;
  phone?: string | null;
  notes?: string | null;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export class Contact extends AggregateRoot<ContactProps> {
  static reconstitute(props: ContactProps): Contact {
    return new Contact(props);
  }

  static create(props: Omit<ContactProps, 'id' | 'createdAt' | 'updatedAt'>): Result<Contact> {
    if (!props.email || !this.isValidEmail(props.email)) {
      return Result.err(new Error('Valid email is required'));
    }

    if (!props.displayName || props.displayName.trim().length === 0) {
      return Result.err(new Error('Display name is required'));
    }

    return Result.ok(
      new Contact({
        ...props,
        id: crypto.randomUUID(),
        email: props.email.toLowerCase().trim(),
        displayName: props.displayName.trim(),
        tags: props.tags || [],
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
  }

  private static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  update(updates: {
    displayName?: string;
    phone?: string | null;
    notes?: string | null;
  }): Result<void> {
    const previousState = {
      displayName: this.props.displayName,
      phone: this.props.phone,
      notes: this.props.notes,
    };

    if (updates.displayName !== undefined) {
      if (updates.displayName.trim().length === 0) {
        return Result.err(new Error('Display name cannot be empty'));
      }
      this.props.displayName = updates.displayName.trim();
    }

    if (updates.phone !== undefined) {
      this.props.phone = updates.phone;
    }

    if (updates.notes !== undefined) {
      this.props.notes = updates.notes;
    }

    this.props.updatedAt = new Date();

    this.addDomainEvent(new ContactUpdatedEvent(
      this.props.id,
      this.props.workspaceId,
      previousState,
      {
        displayName: this.props.displayName,
        phone: this.props.phone,
        notes: this.props.notes,
      },
    ));

    return Result.ok(undefined);
  }

  addTag(tag: string): Result<void> {
    const normalizedTag = tag.trim().toLowerCase();
    if (normalizedTag.length === 0) {
      return Result.err(new Error('Tag cannot be empty'));
    }

    if (this.props.tags.includes(normalizedTag)) {
      return Result.ok(undefined);
    }

    this.props.tags.push(normalizedTag);
    this.props.updatedAt = new Date();

    this.addDomainEvent(new ContactTaggedEvent(
      this.props.id,
      this.props.workspaceId,
      normalizedTag,
      'added',
    ));

    return Result.ok(undefined);
  }

  removeTag(tag: string): Result<void> {
    const normalizedTag = tag.trim().toLowerCase();
    const index = this.props.tags.indexOf(normalizedTag);
    if (index === -1) {
      return Result.ok(undefined);
    }

    this.props.tags.splice(index, 1);
    this.props.updatedAt = new Date();

    this.addDomainEvent(new ContactTaggedEvent(
      this.props.id,
      this.props.workspaceId,
      normalizedTag,
      'removed',
    ));

    return Result.ok(undefined);
  }

  hasTag(tag: string): boolean {
    return this.props.tags.includes(tag.trim().toLowerCase());
  }
}

export class ContactUpdatedEvent implements DomainEvent {
  static readonly TYPE = 'contact.updated';
  readonly type = ContactUpdatedEvent.TYPE;
  readonly version = 1;
  readonly timestamp: Date;
  readonly contactId: string;
  readonly workspaceId: string;
  readonly previousState: {
    displayName: string;
    phone?: string | null;
    notes?: string | null;
  };
  readonly newState: {
    displayName: string;
    phone?: string | null;
    notes?: string | null;
  };

  constructor(
    contactId: string,
    workspaceId: string,
    previousState: { displayName: string; phone?: string | null; notes?: string | null },
    newState: { displayName: string; phone?: string | null; notes?: string | null },
  ) {
    this.contactId = contactId;
    this.workspaceId = workspaceId;
    this.previousState = previousState;
    this.newState = newState;
    this.timestamp = new Date();
  }
}

export class ContactTaggedEvent implements DomainEvent {
  static readonly TYPE = 'contact.tagged';
  readonly type = ContactTaggedEvent.TYPE;
  readonly version = 1;
  readonly timestamp: Date;
  readonly contactId: string;
  readonly workspaceId: string;
  readonly tag: string;
  readonly action: 'added' | 'removed';

  constructor(
    contactId: string,
    workspaceId: string,
    tag: string,
    action: 'added' | 'removed',
  ) {
    this.contactId = contactId;
    this.workspaceId = workspaceId;
    this.tag = tag;
    this.action = action;
    this.timestamp = new Date();
  }
}