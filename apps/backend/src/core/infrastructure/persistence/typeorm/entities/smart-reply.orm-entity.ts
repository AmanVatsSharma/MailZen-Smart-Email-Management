// apps/backend/src/core/infrastructure/persistence/typeorm/entities/smart-reply.orm-entity.ts
import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn } from 'typeorm';

@Entity({ name: 'smart_replies' })
@Index(['emailId'])
export class SmartReplyOrmEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') emailId: string;
  @Column('uuid') workspaceId: string;
  @Column('uuid') userId: string;
  @Column({ type: 'jsonb' }) suggestions: Array<{ text: string; score: number; tone: string }>;
  @Column({ type: 'int', nullable: true }) acceptedIndex: number | null;
  @Column({ type: 'jsonb', default: () => "'[]'" }) rejectedIndices: number[];
  @CreateDateColumn() createdAt: Date;
}
