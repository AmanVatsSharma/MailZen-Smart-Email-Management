// apps/backend/src/core/infrastructure/persistence/typeorm/entities/subscription.orm-entity.ts
import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'subscriptions' })
@Index(['workspaceId'], { unique: true })
export class SubscriptionOrmEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') workspaceId: string;
  @Column('uuid') planId: string;
  @Column() status: string;
  @Column({ type: 'timestamptz' }) currentPeriodStart: Date;
  @Column({ type: 'timestamptz' }) currentPeriodEnd: Date;
  @Column({ default: false }) cancelAtPeriodEnd: boolean;
  @Column({ type: 'jsonb', nullable: true }) providerMetadata: Record<string, unknown> | null;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
