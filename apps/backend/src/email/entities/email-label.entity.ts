import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn, Index } from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { EmailLabelAssignment } from './email-label-assignment.entity';

/**
 * EmailLabel Entity - User-created labels for email tagging
 * Supports multi-label organization with custom colors
 */
@Entity('email_labels')
export class EmailLabel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ default: '#4F46E5' })
  color: string;

  @Column()
  @Index()
  userId: string;

  @ManyToOne(() => User, user => user.labels)
  @JoinColumn({ name: 'userId' })
  user: User;

  @OneToMany(() => EmailLabelAssignment, assignment => assignment.label)
  emails: EmailLabelAssignment[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
