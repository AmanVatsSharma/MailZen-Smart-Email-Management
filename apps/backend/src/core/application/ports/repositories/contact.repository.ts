/**
 * File:        apps/backend/src/core/application/ports/repositories/contact.repository.ts
 * Module:      Application Ports
 * Purpose:     Port for persisting Contact aggregate
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Contact } from '../../../domain/bounded-contexts/contacts/contact.aggregate';
import { Result } from '../../../domain/shared/result';

export const CONTACT_REPOSITORY = Symbol('IContactRepository');

export interface ContactQueryFilter {
  workspaceId: string;
  tag?: string;
  searchTerm?: string;
  limit?: number;
  offset?: number;
}

export interface IContactRepository {
  save(contact: Contact): Promise<Result<void, Error>>;
  findById(id: string): Promise<Contact | null>;
  findByWorkspaceId(workspaceId: string): Promise<Contact[]>;
  findByEmail(workspaceId: string, email: string): Promise<Contact | null>;
  findByIds(ids: string[]): Promise<Contact[]>;
  query(filter: ContactQueryFilter): Promise<{ items: Contact[]; total: number }>;
  delete(id: string): Promise<Result<void, Error>>;
  countByWorkspaceId(workspaceId: string): Promise<number>;
}