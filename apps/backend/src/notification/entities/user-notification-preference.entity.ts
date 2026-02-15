import { Field, ID, ObjectType } from '@nestjs/graphql';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@ObjectType()
@Entity('user_notification_preferences')
export class UserNotificationPreference {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Index({ unique: true })
  @Column()
  userId: string;

  @Field()
  @Column({ default: true })
  inAppEnabled: boolean;

  @Field()
  @Column({ default: true })
  emailEnabled: boolean;

  @Field()
  @Column({ default: false })
  pushEnabled: boolean;

  @Field()
  @Column({ default: true })
  syncFailureEnabled: boolean;

  @Field()
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @UpdateDateColumn()
  updatedAt: Date;
}
