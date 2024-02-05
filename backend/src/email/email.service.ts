import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailProviderService } from '../email-integration/email-provider.service';
import { SendEmailInput } from './dto/send-email.input';
import { MailerService } from '@nestjs-modules/mailer';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  constructor(
    private prisma: PrismaService,
    private emailProviderService: EmailProviderService,
    private mailerService: MailerService,
  ) {}

  async sendEmail(input: SendEmailInput, userId: string) {
    // First save the email in database
    const email = await this.prisma.email.create({
      data: {
        subject: input.subject,
        body: input.body,
        from: input.from,
        to: input.to,
        status: input.scheduledAt ? 'SCHEDULED' : 'PENDING',
        scheduledAt: input.scheduledAt,
        userId,
        providerId: input.providerId,
      },
    });

    // Create analytics entry
    await this.prisma.emailAnalytics.create({
      data: {
        emailId: email.id,
        openCount: 0,
        clickCount: 0,
      },
    });

    // If scheduled, return early
    if (input.scheduledAt) {
      return email;
    }

    // Get provider details
    const provider = await this.prisma.emailProvider.findUnique({
      where: { id: input.providerId },
    });

    if (!provider) {
      throw new Error('Email provider not found');
    }

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
      const bodyWithClickTracking = this.addClickTracking(bodyWithTracking, email.id);

      await transporter.sendMail({
        from: input.from,
        to: input.to.join(','),
        subject: input.subject,
        html: bodyWithClickTracking,
      });

      // Update email status
      return this.prisma.email.update({
        where: { id: email.id },
        data: { status: 'SENT' },
      });
    } catch (error) {
      // Update email status on failure
      await this.prisma.email.update({
        where: { id: email.id },
        data: { status: 'FAILED' },
      });
      throw error;
    }
  }

  async sendTemplateEmail(template: string, to: string[], context: any, userId: string) {
    const email = await this.mailerService.sendMail({
      to: to.join(','),
      subject: context.subject,
      template,
      context,
    });

    return this.prisma.email.create({
      data: {
        subject: context.subject,
        body: email.html,
        from: email.from,
        to,
        status: 'SENT',
        userId,
      },
    });
  }

  private addClickTracking(html: string, emailId: string): string {
    const apiUrl = process.env.API_URL || 'http://localhost:3000';
    return html.replace(
      /<a\s+(?:[^>]*?\s+)?href=(["'])(.*?)\1/g,
      `<a href="${apiUrl}/email/track/${emailId}/click?url=$2"`
    );
  }

  async trackOpen(emailId: string) {
    return this.prisma.emailAnalytics.update({
      where: { emailId },
      data: {
        openCount: { increment: 1 },
      },
    });
  }

  async trackClick(emailId: string) {
    return this.prisma.emailAnalytics.update({
      where: { emailId },
      data: {
        clickCount: { increment: 1 },
      },
    });
  }

  async getEmailsByUser(userId: string) {
    return this.prisma.email.findMany({
      where: { userId },
      include: {
        provider: true,
        analytics: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getEmailById(id: string, userId: string) {
    return this.prisma.email.findFirst({
      where: { 
        id,
        userId,
      },
      include: {
        provider: true,
        analytics: true,
      },
    });
  }

  async markEmailRead(emailId: string) {
    return this.prisma.email.update({
      where: { id: emailId },
      data: { status: 'READ' },
    });
  }
}