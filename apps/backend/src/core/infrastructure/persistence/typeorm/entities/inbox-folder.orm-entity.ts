// apps/backend/src/core/infrastructure/persistence/typeorm/entities/inbox-folder.orm-entity.ts
import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'inbox_folders' })
@Index(['mailboxId', 'name'], { unique: true })
export class InboxFolderOrmEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') mailboxId: string;
  @Column() name: string;
  @Column() type: string;
  @Column({ type: 'int', default: 0 }) totalCount: number;
  @Column({ type: 'int', default: 0 }) unreadCount: number;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
