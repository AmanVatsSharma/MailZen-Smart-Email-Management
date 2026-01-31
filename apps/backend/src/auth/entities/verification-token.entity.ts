import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from '../../user/entities/user.entity';

/**
 * VerificationToken Entity - Tokens for email verification and password reset
 * Supports time-limited, single-use verification flows
 */
@Entity('verification_tokens')
@Index(['userId', 'type'])
export class VerificationToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  userId: string;

  @ManyToOne(() => User, user => user.verificationTokens)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ unique: true })
  @Index()
  token: string;

  // Type: EMAIL_VERIFY | PASSWORD_RESET
  @Column()
  type: string;

  @Column({ type: 'timestamp' })
  expiresAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  consumedAt?: Date;

  @CreateDateColumn()
  createdAt: Date;
}
