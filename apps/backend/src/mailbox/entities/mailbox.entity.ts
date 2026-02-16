import { ObjectType, Field, ID, Int } from '@nestjs/graphql';
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';

/**
 * Mailbox Entity - User-owned mailbox at mailzen.com
 * Self-hosted email accounts with SMTP/IMAP configuration
 */
@ObjectType()
@Entity('mailboxes')
@Unique(['localPart', 'domain'])
export class Mailbox {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  userId: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  @Index()
  workspaceId?: string | null;

  @ManyToOne(() => User, (user) => user.mailboxes)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Field()
  @Column()
  localPart: string;

  @Field()
  @Column({ default: 'mailzen.com' })
  domain: string;

  @Field()
  @Column({ unique: true })
  email: string;

  @Field()
  @Column({ default: 'ACTIVE' })
  status: string; // ACTIVE, SUSPENDED

  @Field(() => Int)
  @Column({ default: 51200 })
  quotaLimitMb: number; // 50 GB default

  @Field()
  @Column({ type: 'bigint', default: 0 })
  usedBytes: string; // Using string for bigint compatibility

  // Connection settings for self-hosted server
  @Column({ nullable: true })
  smtpHost?: string;

  @Column({ type: 'int', nullable: true })
  smtpPort?: number;

  @Column({ nullable: true })
  imapHost?: string;

  @Column({ type: 'int', nullable: true })
  imapPort?: number;

  @Column({ nullable: true })
  username?: string;

  @Column({ nullable: true })
  passwordEnc?: string;

  @Column({ nullable: true })
  passwordIv?: string;

  @Column({ type: 'text', nullable: true })
  inboundSyncCursor?: string | null;

  @Column({ type: 'timestamp', nullable: true })
  inboundSyncLastPolledAt?: Date | null;

  @Column({ type: 'text', nullable: true })
  inboundSyncLastError?: string | null;

  @Field()
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @UpdateDateColumn()
  updatedAt: Date;
}
