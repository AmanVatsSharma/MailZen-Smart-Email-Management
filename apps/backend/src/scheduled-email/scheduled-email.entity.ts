import { Field, ObjectType, ID } from '@nestjs/graphql';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@ObjectType()
@Entity('scheduled_emails')
export class ScheduledEmail {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Column()
  subject: string;

  @Field()
  @Column({ type: 'text' })
  body: string;

  @Field(() => [String])
  @Column('text', { array: true })
  recipientIds: string[];

  @Field()
  @Column({ type: 'timestamp' })
  scheduledAt: Date;

  @Field()
  @Column({ default: 'PENDING' })
  status: string; // e.g., 'PENDING', 'SENT'

  @Column()
  @Index()
  userId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
