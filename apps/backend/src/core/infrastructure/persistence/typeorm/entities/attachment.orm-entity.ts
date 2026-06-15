// apps/backend/src/core/infrastructure/persistence/typeorm/entities/attachment.orm-entity.ts
import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn } from 'typeorm';

@Entity({ name: 'attachments' })
@Index(['emailId'])
export class AttachmentOrmEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') emailId: string;
  @Column() filename: string;
  @Column() contentType: string;
  @Column({ type: 'int' }) size: number;
  @Column() storageKey: string;
  @CreateDateColumn() createdAt: Date;
}
