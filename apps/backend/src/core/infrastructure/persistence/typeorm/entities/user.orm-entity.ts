// apps/backend/src/core/infrastructure/persistence/typeorm/entities/user.orm-entity.ts
import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'users' })
@Index(['email'], { unique: true })
export class UserOrmEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ unique: true }) email: string;
  @Column() passwordHash: string;
  @Column({ default: 'user' }) role: string;
  @Column({ type: 'timestamptz', nullable: true }) emailVerifiedAt: Date | null;
  @Column({ default: false }) is2faEnabled: boolean;
  @Column({ type: 'text', nullable: true }) twoFactorSecret: string | null;
  @Column({ default: '' }) displayName: string;
  @Column({ type: 'text', nullable: true }) avatarUrl: string | null;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
