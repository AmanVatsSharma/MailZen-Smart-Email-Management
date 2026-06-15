// apps/backend/src/core/infrastructure/persistence/typeorm/entities/mailbox.orm-entity.ts
import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'mailboxes' })
@Index(['workspaceId', 'userId'])
export class MailboxOrmEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') workspaceId: string;
  @Column('uuid') userId: string;
  @Column() provider: string;
  @Column() emailAddress: string;
  @Column({ default: false }) isPrimary: boolean;
  @Column({ default: true }) isConnected: boolean;
  @Column({ type: 'text', nullable: true }) syncCursor: string | null;
  @Column({ type: 'timestamptz', nullable: true }) lastSyncedAt: Date | null;
  @Column({ type: 'jsonb', nullable: true }) providerMetadata: Record<string, unknown> | null;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
