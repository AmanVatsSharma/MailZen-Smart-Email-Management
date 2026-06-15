// apps/backend/src/core/infrastructure/persistence/typeorm/entities/email-template.orm-entity.ts
import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'email_templates' })
@Index(['workspaceId', 'name'], { unique: true })
export class EmailTemplateOrmEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') workspaceId: string;
  @Column() name: string;
  @Column({ type: 'text' }) subject: string;
  @Column({ type: 'text' }) bodyHtml: string;
  @Column({ type: 'text', default: '' }) bodyText: string;
  @Column({ type: 'jsonb', default: () => "'[]'" }) variables: Array<{ key: string; description: string; required: boolean }>;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
