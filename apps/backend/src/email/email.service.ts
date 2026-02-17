import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../auth/entities/audit-log.entity';
import { Email } from './entities/email.entity';
import { EmailProvider } from '../email-integration/entities/email-provider.entity';
import { EmailAnalytics } from '../email-analytics/entities/email-analytics.entity';
import { EmailProviderService } from '../email-integration/email-provider.service';
import { SendEmailInput } from './dto/send-email.input';
import { MailerService } from '@nestjs-modules/mailer';
import * as nodemailer from 'nodemailer';
import { serializeStructuredLog } from '../common/logging/structured-log.util';

/**
 * EmailService - Handles email sending, tracking, and management
 * Integrates with external providers (Gmail, Outlook, SMTP)
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    @InjectRepository(Email)
    private readonly emailRepository: Repository<Email>,
    @InjectRepository(EmailProvider)
    private readonly providerRepository: Repository<EmailProvider>,
    @InjectRepository(EmailAnalytics)
    private readonly analyticsRepository: Repository<EmailAnalytics>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
    private emailProviderService: EmailProviderService,
    private mailerService: MailerService,
  ) {}

  private async writeAuditLog(input: {
    userId: string;
    action: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    try {
      const auditEntry = this.auditLogRepository.create({
        userId: input.userId,
        action: input.action,
        metadata: input.metadata,
      });
      await this.auditLogRepository.save(auditEntry);
    } catch (error) {
      this.logger.warn(
        serializeStructuredLog({
          event: 'email_audit_log_write_failed',
          userId: input.userId,
          action: input.action,
          error: String(error),
        }),
      );
    }
  }

  /**
   * Send email via configured provider
   * @param input - Email send parameters
   * @param userId - User ID
   * @returns Created email entity
   */
  async sendEmail(input: SendEmailInput, userId: string) {
    this.logger.log(
      serializeStructuredLog({
        event: 'email_send_start',
        userId,
        providerId: input.providerId,
        recipientCount: input.to.length,
        scheduled: Boolean(input.scheduledAt),
      }),
    );

    // First save the email in database
    const email = this.emailRepository.create({
      subject: input.subject,
      body: input.body,
      from: input.from,
      to: input.to,
      status: input.scheduledAt ? 'SCHEDULED' : 'PENDING',
      scheduledAt: input.scheduledAt,
      userId,
      providerId: input.providerId,
    });

    const savedEmail = await this.emailRepository.save(email);
    this.logger.log(
      serializeStructuredLog({
        event: 'email_send_record_persisted',
        userId,
        emailId: savedEmail.id,
        providerId: input.providerId,
      }),
    );

    // Create analytics entry
    const analytics = this.analyticsRepository.create({
      emailId: savedEmail.id,
      openCount: 0,
      clickCount: 0,
    });
    await this.analyticsRepository.save(analytics);
    this.logger.log(
      serializeStructuredLog({
        event: 'email_send_analytics_initialized',
        emailId: savedEmail.id,
      }),
    );
    await this.writeAuditLog({
      userId,
      action: 'email_send_requested',
      metadata: {
        emailId: savedEmail.id,
        providerId: input.providerId,
        recipientCount: input.to.length,
        scheduled: Boolean(input.scheduledAt),
      },
    });

    // If scheduled, return early
    if (input.scheduledAt) {
      this.logger.log(
        serializeStructuredLog({
          event: 'email_send_scheduled',
          emailId: savedEmail.id,
          scheduledAtIso: input.scheduledAt.toISOString(),
        }),
      );
      await this.writeAuditLog({
        userId,
        action: 'email_send_scheduled',
        metadata: {
          emailId: savedEmail.id,
          providerId: input.providerId,
          scheduledAtIso: input.scheduledAt.toISOString(),
          recipientCount: input.to.length,
        },
      });
      return savedEmail;
    }

    // Get provider details
    const provider = await this.providerRepository.findOne({
      where: { id: input.providerId },
    });

    if (!provider) {
      this.logger.warn(
        serializeStructuredLog({
          event: 'email_send_provider_missing',
          userId,
          providerId: input.providerId,
          emailId: savedEmail.id,
        }),
      );
      await this.writeAuditLog({
        userId,
        action: 'email_send_failed',
        metadata: {
          emailId: savedEmail.id,
          providerId: input.providerId,
          reason: 'provider_not_found',
        },
      });
      throw new Error('Email provider not found');
    }

    this.logger.log(
      serializeStructuredLog({
        event: 'email_send_provider_selected',
        emailId: savedEmail.id,
        providerId: provider.id,
        providerType: provider.type,
      }),
    );

    // Configure transport based on provider type
    let transportConfig: Record<string, unknown>;
    switch (provider.type) {
      case 'GMAIL':
      case 'OUTLOOK':
        transportConfig = {
          service: provider.type.toLowerCase(),
          auth: {
            type: 'OAuth2',
            user: provider.email,
            accessToken: provider.accessToken,
          },
        };
        break;
      case 'CUSTOM_SMTP':
        transportConfig = {
          host: provider.host,
          port: provider.port,
          auth: {
            user: provider.email,
            pass: provider.password,
          },
        };
        break;
      default:
        throw new Error(`Unsupported provider type: ${provider.type}`);
    }

    // Create transport and send email
    const transporter = nodemailer.createTransport(
      transportConfig as nodemailer.TransportOptions,
    );

    try {
      // Add tracking pixel for open tracking
      const trackingPixel = `<img src="${process.env.API_URL || 'http://localhost:3000'}/email/track/${email.id}/open" width="1" height="1" />`;
      const bodyWithTracking = input.body + trackingPixel;

      // Add click tracking to links
      const bodyWithClickTracking = this.addClickTracking(
        bodyWithTracking,
        email.id,
      );

      await transporter.sendMail({
        from: input.from,
        to: input.to.join(','),
        subject: input.subject,
        html: bodyWithClickTracking,
      });

      // Update email status
      this.logger.log(
        serializeStructuredLog({
          event: 'email_send_completed',
          emailId: savedEmail.id,
          providerId: provider.id,
          providerType: provider.type,
        }),
      );
      await this.emailRepository.update(savedEmail.id, { status: 'SENT' });
      const persistedEmail = await this.emailRepository.findOne({
        where: { id: savedEmail.id },
      });
      await this.writeAuditLog({
        userId,
        action: 'email_sent',
        metadata: {
          emailId: savedEmail.id,
          providerId: provider.id,
          providerType: provider.type,
          recipientCount: input.to.length,
        },
      });
      return persistedEmail;
    } catch (error: unknown) {
      // Update email status on failure
      this.logger.error(
        serializeStructuredLog({
          event: 'email_send_failed',
          emailId: savedEmail.id,
          providerId: provider.id,
          providerType: provider.type,
          error: error instanceof Error ? error.message : 'unknown send error',
        }),
      );
      await this.emailRepository.update(savedEmail.id, { status: 'FAILED' });
      await this.writeAuditLog({
        userId,
        action: 'email_send_failed',
        metadata: {
          emailId: savedEmail.id,
          providerId: provider.id,
          providerType: provider.type,
          error: error instanceof Error ? error.message : 'unknown send error',
        },
      });
      throw error;
    }
  }

  /**
   * Send email using template
   * @param template - Template name
   * @param to - Recipient emails
   * @param context - Template context data
   * @param userId - User ID
   * @returns Created email entity
   */
  async sendTemplateEmail(
    template: string,
    to: string[],
    context: { subject: string; [key: string]: unknown },
    userId: string,
  ) {
    this.logger.log(
      serializeStructuredLog({
        event: 'email_template_send_start',
        userId,
        template,
        recipientCount: to.length,
      }),
    );
    try {
      const emailResponse: unknown = await this.mailerService.sendMail({
        to: to.join(','),
        subject: context.subject,
        template,
        context,
      });
      const normalizedEmailResponse =
        emailResponse &&
        typeof emailResponse === 'object' &&
        !Array.isArray(emailResponse)
          ? (emailResponse as Record<string, unknown>)
          : {};
      const responseHtml =
        typeof normalizedEmailResponse.html === 'string'
          ? normalizedEmailResponse.html
          : '';
      const responseFrom =
        typeof normalizedEmailResponse.from === 'string'
          ? normalizedEmailResponse.from
          : '';

      const savedEmail = this.emailRepository.create({
        subject: context.subject,
        body: responseHtml,
        from: responseFrom,
        to,
        status: 'SENT',
        userId,
      });

      const result = await this.emailRepository.save(savedEmail);
      this.logger.log(
        serializeStructuredLog({
          event: 'email_template_send_completed',
          userId,
          emailId: result.id,
          template,
        }),
      );
      await this.writeAuditLog({
        userId,
        action: 'email_template_sent',
        metadata: {
          emailId: result.id,
          template,
          recipientCount: to.length,
        },
      });

      return result;
    } catch (error) {
      await this.writeAuditLog({
        userId,
        action: 'email_template_send_failed',
        metadata: {
          template,
          recipientCount: to.length,
          error: error instanceof Error ? error.message : String(error),
        },
      });
      throw error;
    }
  }

  private addClickTracking(html: string, emailId: string): string {
    const apiUrl = process.env.API_URL || 'http://localhost:3000';
    return html.replace(
      /<a\s+(?:[^>]*?\s+)?href=(["'])(.*?)\1/g,
      `<a href="${apiUrl}/email/track/${emailId}/click?url=$2"`,
    );
  }

  /**
   * Track email open event
   * @param emailId - Email ID
   * @returns Updated analytics
   */
  async trackOpen(emailId: string) {
    this.logger.log(
      serializeStructuredLog({
        event: 'email_track_open_start',
        emailId,
      }),
    );

    const analytics = await this.analyticsRepository.findOne({
      where: { emailId },
    });
    if (analytics) {
      analytics.openCount += 1;
      return this.analyticsRepository.save(analytics);
    }
    return null;
  }

  /**
   * Track email link click event
   * @param emailId - Email ID
   * @returns Updated analytics
   */
  async trackClick(emailId: string) {
    this.logger.log(
      serializeStructuredLog({
        event: 'email_track_click_start',
        emailId,
      }),
    );

    const analytics = await this.analyticsRepository.findOne({
      where: { emailId },
    });
    if (analytics) {
      analytics.clickCount += 1;
      return this.analyticsRepository.save(analytics);
    }
    return null;
  }

  /**
   * Get emails for a user, optionally filtered by provider
   * @param userId - User ID
   * @param providerId - Optional provider filter
   * @returns Array of emails with relations
   */
  async getEmailsByUser(userId: string, providerId?: string | null) {
    this.logger.log(
      serializeStructuredLog({
        event: 'email_list_by_user_start',
        userId,
        providerId: providerId || null,
      }),
    );

    const where: { userId: string; providerId?: string } = { userId };
    if (providerId) {
      where.providerId = providerId;
    }

    const emails = await this.emailRepository.find({
      where,
      relations: ['provider', 'analytics'],
      order: { createdAt: 'DESC' },
    });

    this.logger.log(
      serializeStructuredLog({
        event: 'email_list_by_user_completed',
        userId,
        providerId: providerId || null,
        resultCount: emails.length,
      }),
    );
    return emails;
  }

  /**
   * Get single email by ID for a user
   * @param id - Email ID
   * @param userId - User ID
   * @returns Email with relations
   */
  async getEmailById(id: string, userId: string) {
    this.logger.log(
      serializeStructuredLog({
        event: 'email_get_by_id_start',
        emailId: id,
        userId,
      }),
    );

    return this.emailRepository.findOne({
      where: { id, userId },
      relations: ['provider', 'analytics'],
    });
  }

  /**
   * Mark email as read
   * @param emailId - Email ID
   * @param userId - User ID
   * @returns Updated email
   */
  async markEmailRead(emailId: string, userId: string) {
    this.logger.log(
      serializeStructuredLog({
        event: 'email_mark_read_start',
        emailId,
        userId,
      }),
    );

    const existingEmail = await this.emailRepository.findOne({
      where: { id: emailId, userId },
    });
    if (!existingEmail) {
      throw new NotFoundException('Email not found');
    }
    await this.emailRepository.update({ id: emailId, userId }, { status: 'READ' });
    const updatedEmail = await this.emailRepository.findOne({
      where: { id: emailId, userId },
    });
    if (!updatedEmail) {
      throw new NotFoundException('Email not found');
    }
    await this.writeAuditLog({
      userId,
      action: 'email_marked_read',
      metadata: {
        emailId: updatedEmail.id,
        previousStatus: existingEmail.status,
        nextStatus: updatedEmail.status,
      },
    });
    return updatedEmail;
  }
}
