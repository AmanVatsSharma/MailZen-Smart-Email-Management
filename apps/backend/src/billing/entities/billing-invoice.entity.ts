import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

/**
 * BillingInvoice tracks invoice lifecycle for plan billing events.
 * It is provider-agnostic and can be mapped to Stripe/Razorpay/etc invoice IDs.
 */
@ObjectType()
@Entity('billing_invoices')
@Unique(['provider', 'providerInvoiceId'])
export class BillingInvoice {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Index()
  @Column()
  userId: string;

  @Field({ nullable: true })
  @Index()
  @Column({ nullable: true })
  subscriptionId?: string | null;

  @Field()
  @Column()
  planCode: string;

  @Field()
  @Column()
  invoiceNumber: string;

  @Field()
  @Column({ default: 'INTERNAL' })
  provider: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  providerInvoiceId?: string | null;

  @Field()
  @Column({ default: 'open' })
  status: string;

  @Field(() => Int)
  @Column({ type: 'int', default: 0 })
  amountCents: number;

  @Field()
  @Column({ default: 'USD' })
  currency: string;

  @Field()
  @Column({ type: 'timestamp' })
  periodStart: Date;

  @Field()
  @Column({ type: 'timestamp' })
  periodEnd: Date;

  @Field({ nullable: true })
  @Column({ type: 'timestamp', nullable: true })
  dueAt?: Date | null;

  @Field({ nullable: true })
  @Column({ type: 'timestamp', nullable: true })
  paidAt?: Date | null;

  @Field({ nullable: true })
  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown> | null;

  @Field()
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @UpdateDateColumn()
  updatedAt: Date;
}
