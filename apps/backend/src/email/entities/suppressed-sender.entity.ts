/**
 * File:        apps/backend/src/email/entities/suppressed-sender.entity.ts
 * Module:      Email · Suppressed Senders
 * Purpose:     Persists sender addresses that a user has unsubscribed from so
 *              future mail from those addresses can be filtered or surfaced separately.
 *
 * Exports:
 *   - SuppressedSender  — TypeORM entity modelling the suppressed_senders table
 *
 * Depends on:
 *   - none (entity-only file; imports are TypeORM decorators)
 *
 * Side-effects:
 *   - none
 *
 * Key invariants:
 *   - (userId, senderEmail) is UNIQUE — double-unsubscribe never creates duplicate rows
 *   - senderEmail is stored in its original mixed-case form (comparison callers should
 *     normalise to lower-case before querying)
 *
 * Read order:
 *   1. SuppressedSender  — single exported entity
 *
 * Author:      AmanVatsSharma
 * Last-updated: 2026-04-20
 */

import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
  Unique,
} from 'typeorm';

@Entity('suppressed_senders')
@Unique(['userId', 'senderEmail'])
export class SuppressedSender {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  userId: string;

  @Column()
  senderEmail: string;

  @CreateDateColumn()
  createdAt: Date;
}
