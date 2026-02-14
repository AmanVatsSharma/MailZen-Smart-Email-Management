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
import { User } from '../../user/entities/user.entity';

/**
 * EmailFilter Entity - User-defined email filtering rules
 * Supports automatic email organization and processing
 */
@Entity('email_filters')
export class EmailFilter {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  // Array of EmailFilterRule objects
  @Column({ type: 'jsonb' })
  rules: Record<string, any>;

  @Column()
  @Index()
  userId: string;

  @ManyToOne(() => User, (user) => user.filters)
  @JoinColumn({ name: 'userId' })
  user: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
