import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * SignupVerification Entity - Signup OTPs prior to user creation
 * Verifies phone numbers during registration before user account exists
 */
@Entity('signup_verifications')
export class SignupVerification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
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
