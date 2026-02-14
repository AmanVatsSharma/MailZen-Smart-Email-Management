import { ObjectType, Field, ID, Int } from '@nestjs/graphql';
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Email } from '../../email/entities/email.entity';

/**
 * EmailAnalytics Entity - Tracks email opens and link clicks
 * Provides engagement metrics for sent emails
 */
@ObjectType()
@Entity('email_analytics')
export class EmailAnalytics {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Column({ unique: true })
  emailId: string;

  @OneToOne(() => Email, (email) => email.analytics)
  @JoinColumn({ name: 'emailId' })
  email: Email;

  @Field(() => Int)
  @Column({ default: 0 })
  openCount: number;

  @Field(() => Int)
  @Column({ default: 0 })
  clickCount: number;

  @Field()
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @UpdateDateColumn()
  updatedAt: Date;
}
