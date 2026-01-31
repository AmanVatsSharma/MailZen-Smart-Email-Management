import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from './email.service';
import { StartWarmupInput, PauseWarmupInput, WarmupConfigInput } from './dto/warmup.input';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';

@Injectable()
export class EmailWarmupService {
  private readonly logger = new Logger(EmailWarmupService.name);
  
  // More diverse subject lines for better deliverability
  private readonly warmupSubjects = [
    'Quick update on our project',
    'Following up on our conversation',
    'Checking in about our meeting',
    'Information you requested',
    'Thoughts on our recent discussion',
    'Important update for you',
    'Quick question about our project',
    'Sharing some resources with you',
    'Feedback on our recent collaboration',
    'Scheduling our next meeting',
    'Weekly progress report',
    'Monthly newsletter',
    'Invitation to our webinar',
    'Thank you for your feedback',
    'New feature announcement',
    'Important security update',
    'Your account summary',
    'Upcoming event details',
    'Product update information',
    'Request for your input',
  ];

  // More diverse email bodies for better deliverability
  private readonly warmupBodies = [
    'Just wanted to follow up on our recent conversation. Looking forward to your thoughts!',
    'I hope this email finds you well. I wanted to share some updates on our project progress.',
    'Thank you for your time during our recent meeting. I\'ve attached some notes for your reference.',
    'I\'ve been thinking about the points you raised in our discussion and have some additional thoughts to share.',
    'Just checking in to see how things are progressing on your end. Let me know if you need any assistance!',
    'I found some interesting resources that might be relevant to our project. Would love to discuss them with you.',
    'I wanted to follow up on the action items from our last meeting. Please let me know if you have any questions.',
    'I hope your week is going well. I wanted to touch base about our upcoming deadline.',
    'I\'ve been working on the suggestions you provided and wanted to share my progress with you.',
    'Just sending a quick note to confirm our meeting next week. Looking forward to catching up!',
    'Here\'s our weekly progress report. We\'ve made significant strides in several key areas.',
    'Welcome to our monthly newsletter! We have some exciting updates to share with you.',
    'We\'re hosting a webinar next month on industry best practices. Would you be interested in attending?',
    'Thank you for your valuable feedback. We\'ve implemented several of your suggestions.',
    'We\'re excited to announce a new feature that will streamline your workflow significantly.',
    'We\'ve updated our security protocols to better protect your data. No action is required on your part.',
    'Here\'s a summary of your account activity for the past month. Everything looks good!',
    'We have an upcoming event that might interest you. Details are included below.',
    'Our product team has released an update that addresses several of the issues you reported.',
    'We\'re conducting a survey to improve our services and would appreciate your input.',
  ];

  // HTML templates for more engaging emails
  private readonly htmlTemplates = [
    `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
      <p>{{body}}</p>
      <p style="margin-top: 20px;">Best regards,<br>{{sender}}</p>
    </div>`,
    
    `<div style="font-family: Helvetica, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #444; border-top: 3px solid #4F46E5;">
      <p>{{body}}</p>
      <p style="margin-top: 20px;">Warm regards,<br>{{sender}}</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
      <p style="font-size: 12px; color: #888;">This is an automated message. Please do not reply directly to this email.</p>
    </div>`,
    
    `<div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; background-color: #f9f9f9;">
      <p>{{body}}</p>
      <p style="margin-top: 20px;">Sincerely,<br>{{sender}}</p>
    </div>`,
    
    `<div style="font-family: Tahoma, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
      <p>{{body}}</p>
      <div style="margin-top: 20px; padding-top: 15px; border-top: 1px dashed #ccc;">
        <p>Thanks,<br>{{sender}}</p>
      </div>
    </div>`,
    
    `<div style="font-family: Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; border-left: 4px solid #4F46E5; padding-left: 15px;">
      <p>{{body}}</p>
      <p style="margin-top: 20px;">Regards,<br>{{sender}}</p>
    </div>`,
  ];

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  async startWarmup(input: StartWarmupInput, userId: string) {
    try {
      // Verify provider ownership
      const provider = await this.prisma.emailProvider.findFirst({
        where: { id: input.providerId, userId },
        include: { warmup: true },
      });

      if (!provider) {
        throw new NotFoundException(`Provider with ID ${input.providerId} not found`);
      }

      if (provider.warmup) {
        // Resume if paused
        if (provider.warmup.status === 'PAUSED') {
          this.logger.log(`Resuming warmup for provider ${input.providerId}`);
          return this.prisma.emailWarmup.update({
            where: { id: provider.warmup.id },
            data: { status: 'ACTIVE' },
          });
        }
        throw new Error('Warm-up process already exists for this provider');
      }

      // Set default values if config is not provided
      const dailyIncrement = input.config?.dailyIncrement || 5;
      const maxDailyEmails = input.config?.maxDailyEmails || 100;
      const minimumInterval = input.config?.minimumInterval || 15;
      const targetOpenRate = input.config?.targetOpenRate || 80;
      
      this.logger.log(`Starting new warmup for provider ${input.providerId} with dailyIncrement=${dailyIncrement}, maxDailyEmails=${maxDailyEmails}`);
      return this.prisma.emailWarmup.create({
        data: {
          providerId: input.providerId,
          dailyIncrement,
          maxDailyEmails,
          minimumInterval,
          targetOpenRate,
          status: 'ACTIVE',
        },
      });
    } catch (error) {
      this.logger.error(`Error starting warmup: ${error.message}`, error.stack);
      throw error;
    }
  }

  async pauseWarmup(input: PauseWarmupInput, userId: string) {
    try {
      const warmup = await this.prisma.emailWarmup.findFirst({
        where: {
          providerId: input.providerId,
          provider: { userId },
        },
      });

      if (!warmup) {
        throw new NotFoundException('Warm-up process not found');
      }

      this.logger.log(`Pausing warmup for provider ${input.providerId}`);
      return this.prisma.emailWarmup.update({
        where: { id: warmup.id },
        data: { status: 'PAUSED' },
      });
    } catch (error) {
      this.logger.error(`Error pausing warmup: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async processWarmups() {
    try {
      this.logger.log('Processing daily warmup updates');
      const activeWarmups = await this.prisma.emailWarmup.findMany({
        where: { status: 'ACTIVE' },
        include: { provider: true },
      });

      this.logger.log(`Found ${activeWarmups.length} active warmups to process`);

      for (const warmup of activeWarmups) {
        try {
          // Calculate new daily limit based on performance
          const yesterdayActivity = await this.prisma.warmupActivity.findFirst({
            where: {
              warmupId: warmup.id,
              date: {
                gte: new Date(new Date().setDate(new Date().getDate() - 1)),
              },
            },
          });

          let newDailyLimit = warmup.currentDailyLimit;
          
          if (yesterdayActivity && yesterdayActivity.openRate >= warmup.targetOpenRate) {
            newDailyLimit = Math.min(
              warmup.currentDailyLimit + warmup.dailyIncrement,
              warmup.maxDailyEmails
            );
            this.logger.log(`Increasing daily limit for warmup ${warmup.id} to ${newDailyLimit}`);
          } else if (yesterdayActivity) {
            this.logger.log(`Maintaining daily limit for warmup ${warmup.id} at ${newDailyLimit} (open rate: ${yesterdayActivity.openRate}%)`);
          }

          // Update warm-up configuration
          await this.prisma.emailWarmup.update({
            where: { id: warmup.id },
            data: { currentDailyLimit: newDailyLimit },
          });

          // Create new activity record for today
          await this.prisma.warmupActivity.create({
            data: {
              warmupId: warmup.id,
              emailsSent: 0,
              openRate: 0,
            },
          });
        } catch (error) {
          this.logger.error(`Error processing warmup ${warmup.id}: ${error.message}`, error.stack);
          // Continue with next warmup
        }
      }
    } catch (error) {
      this.logger.error(`Error in processWarmups: ${error.message}`, error.stack);
    }
  }

  @Cron(CronExpression.EVERY_30_MINUTES)
  async sendWarmupEmails() {
    try {
      this.logger.log('Checking for warmup emails to send');
      const activeWarmups = await this.prisma.emailWarmup.findMany({
        where: { 
          status: 'ACTIVE',
          lastRunAt: {
            lt: new Date(Date.now() - 1000 * 60 * 15), // Only process if last run was > 15 minutes ago
          },
        },
        include: { 
          provider: true,
          activities: {
            where: {
              date: {
                gte: new Date(new Date().setHours(0, 0, 0, 0)),
              },
            },
          },
        },
      });

      this.logger.log(`Found ${activeWarmups.length} warmups eligible for sending`);

      for (const warmup of activeWarmups) {
        const todayActivity = warmup.activities[0];
        
        if (!todayActivity) {
          this.logger.warn(`No activity record found for warmup ${warmup.id}, skipping`);
          continue;
        }
        
        if (todayActivity.emailsSent >= warmup.currentDailyLimit) {
          this.logger.log(`Daily limit reached for warmup ${warmup.id}, skipping`);
          continue;
        }

        // Send warm-up email with varied content
        try {
          // Get random subject, body, and template
          const subjectIndex = Math.floor(Math.random() * this.warmupSubjects.length);
          const bodyIndex = Math.floor(Math.random() * this.warmupBodies.length);
          const templateIndex = Math.floor(Math.random() * this.htmlTemplates.length);
          
          const subject = this.warmupSubjects[subjectIndex];
          const bodyText = this.warmupBodies[bodyIndex];
          const senderName = warmup.provider.email.split('@')[0];
          
          // Generate HTML content from template
          const body = this.htmlTemplates[templateIndex]
            .replace('{{body}}', bodyText)
            .replace('{{sender}}', senderName);
          
          // Add some randomization to make each email unique
          const uniqueId = Math.random().toString(36).substring(2, 10);
          const finalBody = `${body}
            <!-- Unique identifier: ${uniqueId} -->
            <img src="https://via.placeholder.com/1x1.png?text=${uniqueId}" width="1" height="1" style="display:none">`;
          
          this.logger.log(`Sending warmup email #${todayActivity.emailsSent + 1}/${warmup.currentDailyLimit} for provider ${warmup.providerId}`);
          
          await this.emailService.sendEmail({
            subject,
            body: finalBody,
            from: warmup.provider.email,
            to: [warmup.provider.email], // Send to self for warm-up
            providerId: warmup.providerId,
          }, warmup.provider.userId);

          // Update activity record
          await this.prisma.warmupActivity.update({
            where: { id: todayActivity.id },
            data: { emailsSent: todayActivity.emailsSent + 1 },
          });

          // Update last run time
          await this.prisma.emailWarmup.update({
            where: { id: warmup.id },
            data: { lastRunAt: new Date() },
          });
        } catch (error) {
          this.logger.error(`Error sending warm-up email for provider ${warmup.providerId}: ${error.message}`, error.stack);
        }
      }
    } catch (error) {
      this.logger.error(`Error in sendWarmupEmails: ${error.message}`, error.stack);
    }
  }

  async getWarmupStatus(providerId: string, userId: string) {
    try {
      const warmup = await this.prisma.emailWarmup.findFirst({
        where: {
          providerId,
          provider: { userId },
        },
        include: {
          activities: {
            orderBy: { date: 'desc' },
            take: 7,
          },
        },
      });
      
      return warmup;
    } catch (error) {
      this.logger.error(`Error getting warmup status: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getWarmupPerformanceMetrics(warmupId: string): Promise<{
    averageOpenRate: number;
    totalEmailsSent: number;
    daysActive: number;
    currentPhase: string;
  }> {
    try {
      const warmup = await this.prisma.emailWarmup.findUnique({
        where: { id: warmupId },
        include: { activities: true },
      });

      if (!warmup) {
        throw new NotFoundException('Warm-up process not found');
      }

      const totalEmailsSent = warmup.activities.reduce((sum, activity) => sum + activity.emailsSent, 0);
      const totalOpenRate = warmup.activities.reduce((sum, activity) => sum + activity.openRate, 0);
      const daysActive = warmup.activities.length;
      const averageOpenRate = daysActive > 0 ? totalOpenRate / daysActive : 0;

      // Calculate warm-up phase based on current daily limit
      let currentPhase = 'Initial';
      if (warmup.currentDailyLimit >= warmup.maxDailyEmails) {
        currentPhase = 'Completed';
      } else if (warmup.currentDailyLimit >= warmup.maxDailyEmails * 0.7) {
        currentPhase = 'Advanced';
      } else if (warmup.currentDailyLimit >= warmup.maxDailyEmails * 0.3) {
        currentPhase = 'Intermediate';
      }

      return {
        averageOpenRate,
        totalEmailsSent,
        daysActive,
        currentPhase,
      };
    } catch (error) {
      this.logger.error(`Error getting warmup metrics: ${error.message}`, error.stack);
      throw error;
    }
  }

  async adjustWarmupStrategy(warmupId: string) {
    try {
      const warmup = await this.prisma.emailWarmup.findUnique({
        where: { id: warmupId },
        include: { 
          activities: {
            orderBy: { date: 'desc' },
            take: 7,
          },
        },
      });

      if (!warmup) {
        throw new NotFoundException('Warm-up process not found');
      }

      // Calculate recent performance
      const recentActivities = warmup.activities.slice(0, 3);
      const averageRecentOpenRate = recentActivities.length > 0 
        ? recentActivities.reduce((sum, activity) => sum + activity.openRate, 0) / recentActivities.length
        : 0;

      // Adjust strategy based on performance
      let adjustedDailyIncrement = warmup.dailyIncrement;
      let adjustedMinimumInterval = warmup.minimumInterval;

      if (averageRecentOpenRate < warmup.targetOpenRate * 0.8) {
        // Poor performance - slow down
        adjustedDailyIncrement = Math.max(1, warmup.dailyIncrement - 2);
        adjustedMinimumInterval = Math.min(60, warmup.minimumInterval + 5);
        this.logger.log(`Slowing down warmup ${warmupId} due to poor performance (${averageRecentOpenRate}%)`);
      } else if (averageRecentOpenRate > warmup.targetOpenRate * 1.2) {
        // Excellent performance - speed up
        adjustedDailyIncrement = Math.min(10, warmup.dailyIncrement + 2);
        adjustedMinimumInterval = Math.max(10, warmup.minimumInterval - 5);
        this.logger.log(`Speeding up warmup ${warmupId} due to excellent performance (${averageRecentOpenRate}%)`);
      } else {
        this.logger.log(`Maintaining current warmup strategy for ${warmupId} (${averageRecentOpenRate}%)`);
      }

      return this.prisma.emailWarmup.update({
        where: { id: warmupId },
        data: {
          dailyIncrement: adjustedDailyIncrement,
          minimumInterval: adjustedMinimumInterval,
        },
      });
    } catch (error) {
      this.logger.error(`Error adjusting warmup strategy: ${error.message}`, error.stack);
      throw error;
    }
  }
} 