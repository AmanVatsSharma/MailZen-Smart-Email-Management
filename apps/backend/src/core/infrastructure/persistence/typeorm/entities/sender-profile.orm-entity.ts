// apps/backend/src/core/infrastructure/persistence/typeorm/entities/sender-profile.orm-entity.ts
import { Entity, PrimaryGeneratedColumn, Column, Index, UpdateDateColumn, CreateDateColumn } from 'typeorm';

@Entity({ name: 'sender_profiles' })
@Index(['workspaceId', 'emailAddress'], { unique: true })
export class SenderProfileOrmEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') workspaceId: string;
  @Column() emailAddress: string;
  @Column({ type: 'int', default: 0 }) totalReceived: number;
  @Column({ type: 'int', default: 0 }) totalReplied: number;
  @Column({ type: 'int', nullable: true }) averageReplyTimeMs: number | null;
  @Column({ type: 'real', default: 0 }) openRate: number;
  @Column({ type: 'real', default: 0 }) clickRate: number;
  @Column({ type: 'timestamptz', nullable: true }) lastInteractionAt: Date | null;
  @Column({ type: 'real', default: 0.5 }) trustScore: number;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
