import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('mailbox_sync_runs')
export class MailboxSyncRun {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  mailboxId: string;

  @Column()
  @Index()
  userId: string;

  @Column({ nullable: true })
  @Index()
  workspaceId?: string | null;

  @Column({ default: 'SCHEDULER' })
  @Index()
  triggerSource: string;

  @Column()
  @Index()
  runCorrelationId: string;

  @Column({ default: 'SUCCESS' })
  @Index()
  status: string;

  @Column({ type: 'int', default: 0 })
  fetchedMessages: number;

  @Column({ type: 'int', default: 0 })
  acceptedMessages: number;

  @Column({ type: 'int', default: 0 })
  deduplicatedMessages: number;

  @Column({ type: 'int', default: 0 })
  rejectedMessages: number;

  @Column({ nullable: true })
  nextCursor?: string | null;

  @Column({ nullable: true })
  errorMessage?: string | null;

  @Column({ type: 'timestamp' })
  @Index()
  startedAt: Date;

  @Column({ type: 'timestamp' })
  @Index()
  completedAt: Date;

  @Column({ type: 'int', default: 0 })
  durationMs: number;

  @CreateDateColumn()
  createdAt: Date;
}
