import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Email } from './email.entity';

/**
 * Attachment Entity - File attachments for emails
 * Stores metadata and cloud storage URLs for email attachments
 */
@Entity('attachments')
export class Attachment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  filename: string;

  @Column()
  contentType: string;

  @Column({ type: 'int', nullable: true })
  size?: number;

  @Column()
  url: string; // Cloud storage URL

  @Column()
  @Index()
  emailId: string;

  @ManyToOne(() => Email, (email) => email.attachments)
  @JoinColumn({ name: 'emailId' })
  email: Email;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
