// apps/backend/src/core/infrastructure/persistence/typeorm/entities/contact.orm-entity.ts
import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'contacts' })
@Index(['workspaceId', 'email'], { unique: true })
export class ContactOrmEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') workspaceId: string;
  @Column() email: string;
  @Column({ default: '' }) displayName: string;
  @Column({ type: 'text', nullable: true }) phone: string | null;
  @Column({ type: 'text', nullable: true }) notes: string | null;
  @Column({ type: 'jsonb', default: () => "'[]'" }) tags: string[];
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
