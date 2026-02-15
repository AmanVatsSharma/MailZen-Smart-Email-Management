import { Field, ID, ObjectType } from '@nestjs/graphql';
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
 * BillingWebhookEvent stores raw upstream billing events with processing state.
 * This gives auditability + idempotency for provider webhook retries.
 */
@ObjectType()
@Entity('billing_webhook_events')
@Unique(['provider', 'externalEventId'])
export class BillingWebhookEvent {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Column()
  provider: string;

  @Field()
  @Column()
  eventType: string;

  @Field()
  @Index()
  @Column()
  externalEventId: string;

  @Field()
  @Column({ default: 'received' })
  status: string;

  @Field({ nullable: true })
  @Column({ type: 'timestamp', nullable: true })
  processedAt?: Date | null;

  @Field({ nullable: true })
  @Column({ type: 'text', nullable: true })
  errorMessage?: string | null;

  @Field({ nullable: true })
  @Column({ type: 'jsonb', nullable: true })
  payload?: Record<string, unknown> | null;

  @Field()
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @UpdateDateColumn()
  updatedAt: Date;
}
