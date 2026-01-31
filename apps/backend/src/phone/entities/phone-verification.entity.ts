import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from '../../user/entities/user.entity';

/**
 * PhoneVerification Entity - Phone OTP verifications for existing users
 * Manages phone number verification flow with OTP codes
 */
@Entity('phone_verifications')
export class PhoneVerification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  userId: string;

  @ManyToOne(() => User, user => user.phoneVerifications)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  phoneNumber: string;

  @Column()
  code: string;

  @Column({ default: 0 })
  attempts: number;

  @Column({ type: 'timestamp' })
  expiresAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  consumedAt?: Date;

  @CreateDateColumn()
  createdAt: Date;
}
