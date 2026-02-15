import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Email } from './entities/email.entity';
import { EmailProvider } from '../email-integration/entities/email-provider.entity';
import { EmailAnalytics } from '../email-analytics/entities/email-analytics.entity';
import { EmailProviderService } from '../email-integration/email-provider.service';
import { SendEmailInput } from './dto/send-email.input';
import { MailerService } from '@nestjs-modules/mailer';
import * as nodemailer from 'nodemailer';

/**
 * EmailService - Handles email sending, tracking, and management
 * Integrates with external providers (Gmail, Outlook, SMTP)
 */
@Injectable()
export class EmailService {
  constructor(
    @InjectRepository(Email)
    private readonly emailRepository: Repository<Email>,
    @InjectRepository(EmailProvider)
    private readonly providerRepository: Repository<EmailProvider>,
    @InjectRepository(EmailAnalytics)
    private readonly analyticsRepository: Repository<EmailAnalytics>,
    private emailProviderService: EmailProviderService,
    private mailerService: MailerService,
  ) {}

  /**
   * Send email via configured provider
   * @param input - Email send parameters
   * @param userId - User ID
   * @returns Created email entity
   */
  async sendEmail(input: SendEmailInput, userId: string) {
    console.log('[EmailService] Sending email from user:', userId);

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
    console.log('[EmailService] Email saved to database:', savedEmail.id);

    // Create analytics entry
    const analytics = this.analyticsRepository.create({
      emailId: savedEmail.id,
      openCount: 0,
      clickCount: 0,
    });
    await this.analyticsRepository.save(analytics);
    console.log('[EmailService] Analytics entry created');

    // If scheduled, return early
    if (input.scheduledAt) {
      console.log('[EmailService] Email scheduled for:', input.scheduledAt);
      return savedEmail;
    }

    // Get provider details
    const provider = await this.providerRepository.findOne({
      where: { id: input.providerId },
    });

    if (!provider) {
      console.log('[EmailService] Provider not found:', input.providerId);
      throw new Error('Email provider not found');
    }

    console.log('[EmailService] Using provider:', provider.type);

    // Configure transport based on provider type
    let transportConfig;
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
    const transporter = nodemailer.createTransport(transportConfig);

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
      console.log('[EmailService] Email sent successfully');
      await this.emailRepository.update(savedEmail.id, { status: 'SENT' });
      return this.emailRepository.findOne({ where: { id: savedEmail.id } });
    } catch (error) {
      // Update email status on failure
      console.error('[EmailService] Failed to send email:', error);
      await this.emailRepository.update(savedEmail.id, { status: 'FAILED' });
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
    context: any,
    userId: string,
  ) {
    console.log('[EmailService] Sending template email:', template);

    const email = await this.mailerService.sendMail({
      to: to.join(','),
      subject: context.subject,
      template,
      context,
    });

    const savedEmail = this.emailRepository.create({
      subject: context.subject,
      body: email.html,
      from: email.from,
      to,
      status: 'SENT',
      userId,
    });

    const result = await this.emailRepository.save(savedEmail);
    console.log('[EmailService] Template email sent:', result.id);

    return result;
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
    console.log('[EmailService] Tracking email open:', emailId);

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
    console.log('[EmailService] Tracking email click:', emailId);

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
    console.log('[EmailService] Fetching emails for user:', userId);

    const where: any = { userId };
    if (providerId) {
      where.providerId = providerId;
    }

    const emails = await this.emailRepository.find({
      where,
      relations: ['provider', 'analytics'],
      order: { createdAt: 'DESC' },
    });

    console.log('[EmailService] Found', emails.length, 'emails');
    return emails;
  }

  /**
   * Get single email by ID for a user
   * @param id - Email ID
   * @param userId - User ID
   * @returns Email with relations
   */
  async getEmailById(id: string, userId: string) {
    console.log('[EmailService] Fetching email:', id);

    return this.emailRepository.findOne({
      where: { id, userId },
      relations: ['provider', 'analytics'],
    });
  }

  /**
   * Mark email as read
   * @param emailId - Email ID
   * @returns Updated email
   */
  async markEmailRead(emailId: string) {
    console.log('[EmailService] Marking email as read:', emailId);

    await this.emailRepository.update(emailId, { status: 'READ' });
    return this.emailRepository.findOne({ where: { id: emailId } });
  }
}
