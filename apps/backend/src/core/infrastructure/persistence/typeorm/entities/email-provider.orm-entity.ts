// apps/backend/src/core/infrastructure/persistence/typeorm/entities/email-provider.orm-entity.ts
import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'email_providers' })
@Index(['mailboxId', 'provider'], { unique: true })
export class EmailProviderOrmEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') mailboxId: string;
  @Column() provider: string;
  @Column() providerUserId: string;
  @Column({ type: 'text' }) encryptedAccessToken: string;
  @Column({ type: 'text', nullable: true }) encryptedRefreshToken: string | null;
  @Column({ type: 'timestamptz', nullable: true }) tokenExpiresAt: Date | null;
  @Column({ length: 64 }) keyId: string;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
