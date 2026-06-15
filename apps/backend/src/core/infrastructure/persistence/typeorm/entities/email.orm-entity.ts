// apps/backend/src/core/infrastructure/persistence/typeorm/entities/email.orm-entity.ts
import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'emails' })
@Index(['workspaceId', 'status'])
@Index(['threadId'])
@Index(['authorId', 'createdAt'])
export class EmailOrmEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') workspaceId: string;
  @Column('uuid') authorId: string;
  @Column({ type: 'jsonb' }) fromAddress: { value: string };
  @Column({ type: 'jsonb' }) toAddresses: Array<{ value: string }>;
  @Column({ type: 'jsonb', nullable: true }) ccAddresses: Array<{ value: string }> | null;
  @Column({ type: 'jsonb', nullable: true }) bccAddresses: Array<{ value: string }> | null;
  @Column() subject: string;
  @Column({ type: 'text' }) bodyHtml: string;
  @Column({ type: 'text' }) bodyText: string;
  @Column() status: string;
  @Column({ type: 'timestamptz', nullable: true }) scheduledAt: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) sentAt: Date | null;
  @Column({ type: 'uuid', nullable: true }) threadId: string | null;
  @Column({ type: 'uuid', nullable: true }) mailboxId: string | null;
  @Column({ type: 'jsonb', nullable: true }) providerMetadata: Record<string, unknown> | null;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
