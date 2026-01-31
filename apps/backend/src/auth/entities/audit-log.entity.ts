import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from '../../user/entities/user.entity';

/**
 * AuditLog Entity - Security/audit logs for auth events and critical actions
 * Tracks user actions for security monitoring and compliance
 */
@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  @Index()
  userId?: string;

  @ManyToOne(() => User, user => user.auditLogs, { nullable: true })
  @JoinColumn({ name: 'userId' })
  user?: User;

  @Column()
  action: string;

  // JSON metadata for additional context
  @Column({ type: 'jsonb', nullable: true, default: {} })
  metadata?: Record<string, any>;

  @Column({ nullable: true })
  ip?: string;

  @Column({ nullable: true })
  userAgent?: string;

  @CreateDateColumn()
  createdAt: Date;
}
