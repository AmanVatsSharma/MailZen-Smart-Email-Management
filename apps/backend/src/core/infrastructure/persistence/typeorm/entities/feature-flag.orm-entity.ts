// apps/backend/src/core/infrastructure/persistence/typeorm/entities/feature-flag.orm-entity.ts
import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'feature_flags' })
@Index(['workspaceId', 'key'], { unique: true })
export class FeatureFlagOrmEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid', { nullable: true }) workspaceId: string | null;
  @Column() key: string;
  @Column({ default: false }) enabled: boolean;
  @Column({ type: 'int', default: 100 }) rolloutPercent: number;
  @Column({ type: 'jsonb', default: () => "'[]'" }) allowedUserIds: string[];
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
