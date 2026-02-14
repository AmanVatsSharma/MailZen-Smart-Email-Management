import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { Email } from './email.entity';

/**
 * EmailFolder Entity - User-created folders for email organization
 * Provides custom categorization beyond labels
 */
@Entity('email_folders')
export class EmailFolder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  @Index()
  userId: string;

  @ManyToOne(() => User, (user) => user.folders)
  @JoinColumn({ name: 'userId' })
  user: User;

  @OneToMany(() => Email, (email) => email.folder)
  emails: Email[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
