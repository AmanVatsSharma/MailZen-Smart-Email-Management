// apps/backend/src/core/infrastructure/persistence/typeorm/entities/unified-thread.orm-entity.ts
import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'unified_threads' })
@Index(['workspaceId', 'latestEmailAt'])
export class UnifiedThreadOrmEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') workspaceId: string;
  @Column() subject: string;
  @Column({ type: 'jsonb' }) participants: string[];
  @Column({ type: 'jsonb' }) mailboxIds: string[];
  @Column({ type: 'jsonb' }) providerMessageRefs: Array<{ provider: string; threadRef: string; mailboxId: string }>;
  @Column({ type: 'timestamptz' }) latestEmailAt: Date;
  @Column({ type: 'int', default: 0 }) unreadCount: number;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
