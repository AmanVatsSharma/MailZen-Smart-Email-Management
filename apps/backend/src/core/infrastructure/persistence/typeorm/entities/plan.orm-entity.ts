// apps/backend/src/core/infrastructure/persistence/typeorm/entities/plan.orm-entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'plans' })
export class PlanOrmEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ unique: true }) slug: string;
  @Column() name: string;
  @Column({ type: 'int' }) priceCents: number;
  @Column({ length: 3 }) currency: string;
  @Column({ type: 'jsonb' }) features: string[];
  @Column({ type: 'int' }) monthlyAiCredits: number;
  @Column({ type: 'int' }) seats: number;
  @Column({ default: true }) active: boolean;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
