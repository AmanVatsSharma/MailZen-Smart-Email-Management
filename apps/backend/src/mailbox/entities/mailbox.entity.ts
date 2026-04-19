/**
 * File:        apps/backend/src/mailbox/entities/mailbox.entity.ts
 * Module:      Mailbox · Entity
 * Purpose:     TypeORM entity for user-owned @mailzen.com mailboxes, including
 *              workspace sharing flag and self-hosted SMTP/IMAP connection settings.
 *
 * Exports:
 *   - Mailbox — TypeORM entity / NestJS GraphQL ObjectType representing a mailbox row
 *
 * Depends on:
 *   - typeorm — ORM decorators for column definitions and relations
 *   - @nestjs/graphql — ObjectType/Field decorators for code-first schema generation
 *   - ../../user/entities/user.entity — User relation (ManyToOne owner)
 *
 * Side-effects:
 *   - none (pure entity definition)
 *
 * Key invariants:
 *   - (localPart, domain) is unique across the mailboxes table
 *   - email column is unique and derived as `${localPart}@${domain}`
 *   - isShared defaults to false; only set true via shareMailboxWithWorkspace
 *   - workspaceId is nullable; must be set alongside isShared=true for sharing to be effective
 *
 * Read order:
 *   1. Mailbox — full entity shape with all columns
 *
 * Author:      AmanVatsSharma
 * Last-updated: 2026-04-19
 */
import { ObjectType, Field, ID, Int } from '@nestjs/graphql';
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';

@ObjectType()
@Entity('mailboxes')
@Unique(['localPart', 'domain'])
export class Mailbox {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  userId: string;

  @Field(() => String, { nullable: true })
  @Column({ type: 'varchar', nullable: true })
  @Index()
  workspaceId?: string | null;

  @Field(() => Boolean)
  @Column({ default: false })
  isShared: boolean;

  @ManyToOne(() => User, (user) => user.mailboxes)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Field()
  @Column()
  localPart: string;

  @Field()
  @Column({ default: 'mailzen.com' })
  domain: string;

  @Field()
  @Column({ unique: true })
  email: string;

  @Field()
  @Column({ default: 'ACTIVE' })
  status: string; // ACTIVE, SUSPENDED

  @Field(() => Int)
  @Column({ default: 51200 })
  quotaLimitMb: number; // 50 GB default

  @Field()
  @Column({ type: 'bigint', default: 0 })
  usedBytes: string; // Using string for bigint compatibility

  // Connection settings for self-hosted server
  @Column({ nullable: true })
  smtpHost?: string;

  @Column({ type: 'int', nullable: true })
  smtpPort?: number;

  @Column({ nullable: true })
  imapHost?: string;

  @Column({ type: 'int', nullable: true })
  imapPort?: number;

  @Column({ nullable: true })
  username?: string;

  @Column({ nullable: true })
  passwordEnc?: string;

  @Column({ nullable: true })
  passwordIv?: string;

  @Column({ type: 'text', nullable: true })
  inboundSyncCursor?: string | null;

  @Column({ type: 'timestamp', nullable: true })
  inboundSyncLastPolledAt?: Date | null;

  @Column({ type: 'text', nullable: true })
  inboundSyncStatus?: string | null;

  @Column({ type: 'text', nullable: true })
  inboundSyncLastError?: string | null;

  @Column({ type: 'timestamp', nullable: true })
  inboundSyncLastErrorAt?: Date | null;

  @Column({ type: 'text', nullable: true })
  inboundSyncLeaseToken?: string | null;

  @Column({ type: 'timestamp', nullable: true })
  inboundSyncLeaseExpiresAt?: Date | null;

  @Field()
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @UpdateDateColumn()
  updatedAt: Date;
}
