import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Email } from './email.entity';
import { EmailLabel } from './email-label.entity';

/**
 * EmailLabelAssignment Entity - Many-to-many join table for Email and EmailLabel
 * Allows multiple labels per email and multiple emails per label
 */
@Entity('email_label_assignments')
@Unique(['emailId', 'labelId'])
export class EmailLabelAssignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  emailId: string;

  @ManyToOne(() => Email, (email) => email.labels)
  @JoinColumn({ name: 'emailId' })
  email: Email;

  @Column()
  labelId: string;

  @ManyToOne(() => EmailLabel, (label) => label.emails)
  @JoinColumn({ name: 'labelId' })
  label: EmailLabel;

  @CreateDateColumn()
  createdAt: Date;
}
