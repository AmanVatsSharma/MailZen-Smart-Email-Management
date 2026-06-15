// apps/backend/src/core/infrastructure/persistence/typeorm/entities/thread.orm-entity.ts
import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'threads' })
@Index(['workspaceId', 'lastMessageAt'])
export class ThreadOrmEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') workspaceId: string;
  @Column() subject: string;
  @Column({ type: 'jsonb' }) participants: string[];
  @Column({ type: 'timestamptz' }) lastMessageAt: Date;
  @Column({ type: 'int', default: 0 }) messageCount: number;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
