import { ObjectType, Field, ID } from '@nestjs/graphql';
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Feature Entity - Feature flags for application-wide feature toggles
 * Enables/disables features without code deployment
 */
@ObjectType()
@Entity('features')
export class Feature {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Column({ unique: true })
  name: string;

  @Field()
  @Column({ default: 'GLOBAL' })
  targetType: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  targetValue?: string | null;

  @Field()
  @Column({ type: 'integer', default: 100 })
  rolloutPercentage: number;

  @Field()
  @Column({ default: false })
  isActive: boolean;

  @Field()
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @UpdateDateColumn()
  updatedAt: Date;
}
