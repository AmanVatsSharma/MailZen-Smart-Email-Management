import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

@Entity('mailbox_inbound_events')
@Unique(['mailboxId', 'messageId'])
export class MailboxInboundEvent {
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
  messageId?: string | null;

  @Column({ nullable: true })
  @Index()
  emailId?: string | null;

  @Column({ nullable: true })
  inboundThreadKey?: string | null;

  @Column({ default: 'ACCEPTED' })
  status: string;

  @Column({ nullable: true })
  sourceIp?: string | null;

  @Column({ default: false })
  signatureValidated: boolean;

  @Column({ nullable: true })
  errorReason?: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
