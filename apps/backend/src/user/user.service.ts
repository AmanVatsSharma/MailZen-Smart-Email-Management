import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserInput } from './dto/create-user.input';
import { UpdateUserInput } from './dto/update-user.input';
import { AuditLog } from '../auth/entities/audit-log.entity';
import * as bcrypt from 'bcryptjs';
import { AccountDataExportResponse } from './dto/account-data-export.response';
import { EmailProvider } from '../email-integration/entities/email-provider.entity';
import { Mailbox } from '../mailbox/entities/mailbox.entity';
import { WorkspaceMember } from '../workspace/entities/workspace-member.entity';
import { UserSubscription } from '../billing/entities/user-subscription.entity';
import { BillingInvoice } from '../billing/entities/billing-invoice.entity';
import { UserNotification } from '../notification/entities/user-notification.entity';
import {
  fingerprintIdentifier,
  serializeStructuredLog,
} from '../common/logging/structured-log.util';

/**
 * UserService - Handles user CRUD operations and authentication validation
 * Uses TypeORM repositories for database operations
 */
@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
    @InjectRepository(EmailProvider)
    private readonly emailProviderRepository: Repository<EmailProvider>,
    @InjectRepository(Mailbox)
    private readonly mailboxRepository: Repository<Mailbox>,
    @InjectRepository(WorkspaceMember)
    private readonly workspaceMemberRepository: Repository<WorkspaceMember>,
    @InjectRepository(UserSubscription)
    private readonly userSubscriptionRepository: Repository<UserSubscription>,
    @InjectRepository(BillingInvoice)
    private readonly billingInvoiceRepository: Repository<BillingInvoice>,
    @InjectRepository(UserNotification)
    private readonly userNotificationRepository: Repository<UserNotification>,
  ) {}

  /**
   * Create a new user account with hashed password
   * @param createUserInput - User registration data
   * @returns Created user entity
   */
  async createUser(createUserInput: CreateUserInput): Promise<User> {
    const emailFingerprint = fingerprintIdentifier(createUserInput.email || '');
    this.logger.log(
      serializeStructuredLog({
        event: 'user_create_start',
        emailFingerprint,
      }),
    );

    const normalizedEmail = createUserInput.email.trim().toLowerCase();
    if (!normalizedEmail) {
      throw new BadRequestException('Email is required');
    }

    // Check if email already exists
    const existing = await this.userRepository.findOne({
      where: { email: normalizedEmail },
    });
    if (existing) {
      this.logger.warn(
        serializeStructuredLog({
          event: 'user_create_conflict_email_exists',
          emailFingerprint,
        }),
      );
      throw new ConflictException('Email already registered');
    }

    // Hash password with bcrypt (cost factor 12)
    const hashedPassword = await bcrypt.hash(createUserInput.password, 12);

    // Create new user entity
    const user = this.userRepository.create({
      email: normalizedEmail,
      name: createUserInput.name || undefined,
      password: hashedPassword,
    });

    const created = await this.userRepository.save(user);
    this.logger.log(
      serializeStructuredLog({
        event: 'user_create_completed',
        userId: created.id,
        emailFingerprint,
      }),
    );

    return created;
  }

  /**
   * Validate user credentials for login
   * Implements failed login tracking and account lockout
   * @param email - User email
   * @param password - Plain text password
   * @returns User entity if valid, null otherwise
   */
  async validateUser(email: string, password: string): Promise<User | null> {
    const emailFingerprint = fingerprintIdentifier(email || '');
    this.logger.log(
      serializeStructuredLog({
        event: 'user_validate_start',
        emailFingerprint,
      }),
    );

    const normalizedEmail = email.trim().toLowerCase();
    const dbUser = await this.userRepository.findOne({
      where: { email: normalizedEmail },
    });
    const now = new Date();

    if (!dbUser || !dbUser.password) {
      this.logger.warn(
        serializeStructuredLog({
          event: 'user_validate_missing_or_passwordless',
          emailFingerprint,
        }),
      );
      // Audit login failure without user id
      await this.auditLogRepository.save({
        action: 'LOGIN_FAILED',
        metadata: { email: normalizedEmail },
      });
      return null;
    }

    // Check if account is locked out
    if (dbUser.lockoutUntil && dbUser.lockoutUntil > now) {
      this.logger.warn(
        serializeStructuredLog({
          event: 'user_validate_locked_out',
          userId: dbUser.id,
          lockoutUntilIso: dbUser.lockoutUntil.toISOString(),
        }),
      );
      await this.auditLogRepository.save({
        action: 'LOGIN_LOCKED',
        userId: dbUser.id,
        metadata: { until: dbUser.lockoutUntil },
      });
      return null;
    }

    // Verify password with bcrypt
    const isPasswordValid = await bcrypt.compare(password, dbUser.password);
    if (!isPasswordValid) {
      this.logger.warn(
        serializeStructuredLog({
          event: 'user_validate_invalid_password',
          userId: dbUser.id,
        }),
      );

      // Track failed login attempts
      const maxAttempts = parseInt(process.env.LOGIN_MAX_ATTEMPTS || '5', 10);
      const lockoutMinutes = parseInt(
        process.env.LOGIN_LOCKOUT_MINUTES || '15',
        10,
      );
      const newAttempts = (dbUser.failedLoginAttempts ?? 0) + 1;

      const updates: Partial<User> = {
        failedLoginAttempts: newAttempts,
        lastFailedLoginAt: now,
      };

      // Lock account after max attempts
      if (newAttempts >= maxAttempts) {
        updates.lockoutUntil = new Date(
          now.getTime() + lockoutMinutes * 60 * 1000,
        );
        updates.failedLoginAttempts = 0;
        this.logger.warn(
          serializeStructuredLog({
            event: 'user_validate_lockout_applied',
            userId: dbUser.id,
            maxAttempts,
            lockoutMinutes,
          }),
        );
      }

      await this.userRepository.update(dbUser.id, updates);
      await this.auditLogRepository.save({
        action: 'LOGIN_FAILED',
        userId: dbUser.id,
      });
      return null;
    }

    // Successful login - reset failed attempts
    this.logger.log(
      serializeStructuredLog({
        event: 'user_validate_success',
        userId: dbUser.id,
      }),
    );
    await this.userRepository.update(dbUser.id, {
      lastLoginAt: now,
      failedLoginAttempts: 0,
      lockoutUntil: undefined,
    });
    await this.auditLogRepository.save({
      action: 'LOGIN_SUCCESS',
      userId: dbUser.id,
    });

    return dbUser;
  }

  /**
   * Get user by ID
   * @param id - User UUID
   * @returns User entity
   */
  getUser = async (id: string): Promise<User> => {
    this.logger.log(
      serializeStructuredLog({
        event: 'user_get_by_id_start',
        userId: id,
      }),
    );
    const dbUser = await this.userRepository.findOne({ where: { id } });
    if (!dbUser) {
      this.logger.warn(
        serializeStructuredLog({
          event: 'user_get_by_id_missing',
          userId: id,
        }),
      );
      throw new NotFoundException(`User with id ${id} not found.`);
    }
    return dbUser;
  };

  /**
   * Get all users (admin function)
   * @returns Array of user entities
   */
  async getAllUsers(): Promise<User[]> {
    this.logger.log(
      serializeStructuredLog({
        event: 'user_list_start',
      }),
    );
    const users = await this.userRepository.find();
    this.logger.log(
      serializeStructuredLog({
        event: 'user_list_completed',
        userCount: users.length,
      }),
    );
    return users;
  }

  /**
   * Update user profile information
   * @param updateUserInput - Updated user data
   * @returns Updated user entity
   */
  async updateUser(updateUserInput: UpdateUserInput): Promise<User> {
    this.logger.log(
      serializeStructuredLog({
        event: 'user_update_start',
        userId: updateUserInput.id,
      }),
    );

    const updates: Partial<User> = {};
    if (updateUserInput.email) {
      const normalizedEmail = updateUserInput.email.trim().toLowerCase();
      const existingWithEmail = await this.userRepository.findOne({
        where: { email: normalizedEmail },
      });
      if (existingWithEmail && existingWithEmail.id !== updateUserInput.id) {
        throw new ConflictException('Email already registered');
      }
      updates.email = normalizedEmail;
    }
    if (updateUserInput.name !== undefined) {
      updates.name = updateUserInput.name;
    }

    await this.userRepository.update(updateUserInput.id, updates);
    const updated = await this.userRepository.findOne({
      where: { id: updateUserInput.id },
    });

    if (!updated) {
      throw new NotFoundException(
        `User with id ${updateUserInput.id} not found.`,
      );
    }

    this.logger.log(
      serializeStructuredLog({
        event: 'user_update_completed',
        userId: updated.id,
      }),
    );
    return updated;
  }

  async exportUserDataSnapshot(
    userId: string,
  ): Promise<AccountDataExportResponse> {
    this.logger.log(
      serializeStructuredLog({
        event: 'user_data_export_start',
        userId,
      }),
    );
    const user = await this.getUser(userId);
    const generatedAt = new Date();

    const [providers, mailboxes, workspaceMemberships, subscription, invoices] =
      await Promise.all([
        this.emailProviderRepository.find({
          where: { userId },
          order: { createdAt: 'DESC' },
          take: 100,
        }),
        this.mailboxRepository.find({
          where: { userId },
          order: { createdAt: 'DESC' },
          take: 100,
        }),
        this.workspaceMemberRepository.find({
          where: { userId },
          order: { createdAt: 'DESC' },
          take: 200,
        }),
        this.userSubscriptionRepository.findOne({
          where: { userId, status: 'active' },
          order: { createdAt: 'DESC' },
        }),
        this.billingInvoiceRepository.find({
          where: { userId },
          order: { createdAt: 'DESC' },
          take: 100,
        }),
      ]);
    const notifications = await this.userNotificationRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 200,
    });
    const unreadNotifications = notifications.filter(
      (notification) => !notification.isRead,
    ).length;

    const payload = {
      generatedAtIso: generatedAt.toISOString(),
      user: {
        id: user.id,
        email: user.email,
        name: user.name || null,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
        isPhoneVerified: user.isPhoneVerified,
        activeWorkspaceId: user.activeWorkspaceId || null,
        activeInboxType: user.activeInboxType || null,
        activeInboxId: user.activeInboxId || null,
        createdAtIso: user.createdAt.toISOString(),
        updatedAtIso: user.updatedAt.toISOString(),
      },
      providers: providers.map((provider) => ({
        id: provider.id,
        type: provider.type,
        email: provider.email,
        status: provider.status,
        isActive: provider.isActive,
        createdAtIso: provider.createdAt.toISOString(),
        updatedAtIso: provider.updatedAt.toISOString(),
      })),
      mailboxes: mailboxes.map((mailbox) => ({
        id: mailbox.id,
        email: mailbox.email,
        status: mailbox.status,
        workspaceId: mailbox.workspaceId || null,
        quotaLimitMb: mailbox.quotaLimitMb,
        usedBytes: mailbox.usedBytes,
        createdAtIso: mailbox.createdAt.toISOString(),
        updatedAtIso: mailbox.updatedAt.toISOString(),
      })),
      workspaceMemberships: workspaceMemberships.map((membership) => ({
        id: membership.id,
        workspaceId: membership.workspaceId,
        email: membership.email,
        role: membership.role,
        status: membership.status,
        invitedByUserId: membership.invitedByUserId,
        createdAtIso: membership.createdAt.toISOString(),
        updatedAtIso: membership.updatedAt.toISOString(),
      })),
      subscription: subscription
        ? {
            id: subscription.id,
            planCode: subscription.planCode,
            status: subscription.status,
            startedAtIso: subscription.startedAt.toISOString(),
            endsAtIso: subscription.endsAt
              ? subscription.endsAt.toISOString()
              : null,
            isTrial: subscription.isTrial,
            trialEndsAtIso: subscription.trialEndsAt
              ? subscription.trialEndsAt.toISOString()
              : null,
            cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          }
        : null,
      invoices: invoices.map((invoice) => ({
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        planCode: invoice.planCode,
        status: invoice.status,
        amountCents: invoice.amountCents,
        currency: invoice.currency,
        provider: invoice.provider,
        providerInvoiceId: invoice.providerInvoiceId || null,
        createdAtIso: invoice.createdAt.toISOString(),
      })),
      notificationSummary: {
        total: notifications.length,
        unread: unreadNotifications,
      },
      notifications: notifications.map((notification) => ({
        id: notification.id,
        type: notification.type,
        title: notification.title,
        isRead: notification.isRead,
        workspaceId: notification.workspaceId || null,
        createdAtIso: notification.createdAt.toISOString(),
      })),
    };

    const response = {
      generatedAtIso: generatedAt.toISOString(),
      dataJson: JSON.stringify(payload),
    };
    this.logger.log(
      serializeStructuredLog({
        event: 'user_data_export_completed',
        userId,
        providerCount: providers.length,
        mailboxCount: mailboxes.length,
        workspaceMembershipCount: workspaceMemberships.length,
        invoiceCount: invoices.length,
        notificationCount: notifications.length,
      }),
    );
    return response;
  }
}
