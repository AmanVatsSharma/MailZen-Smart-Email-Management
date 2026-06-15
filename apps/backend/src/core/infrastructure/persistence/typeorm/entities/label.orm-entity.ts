// apps/backend/src/core/infrastructure/persistence/typeorm/entities/label.orm-entity.ts
import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'labels' })
@Index(['workspaceId', 'name'], { unique: true })
export class LabelOrmEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') workspaceId: string;
  @Column() name: string;
  @Column({ length: 7, default: '#888888' }) color: string;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
