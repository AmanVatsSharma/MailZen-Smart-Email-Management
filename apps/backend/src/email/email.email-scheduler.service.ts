import { Injectable } from '@nestjs/common';
import { InjectQueue, Process, Processor } from '@nestjs/bull';
import { Queue, Job } from 'bull';
import { EmailService } from './email.service';
import { SendEmailInput } from './dto/send-email.input';

@Injectable()
@Processor('email')
export class EmailSchedulerService {
  constructor(
    @InjectQueue('email') private emailQueue: Queue,
    private emailService: EmailService,
  ) {}

  async scheduleEmail(input: SendEmailInput, userId: string) {
    if (!input.scheduledAt) {
      throw new Error('Scheduled date is required');
    }

    const delay = new Date(input.scheduledAt).getTime() - Date.now();
    if (delay < 0) {
      throw new Error('Cannot schedule email in the past');
    }

    return this.emailQueue.add(
      'send-email',
      { input, userId },
      { delay }
    );
  }

  @Process('send-email')
  async processScheduledEmail(job: Job<{ input: SendEmailInput; userId: string }>) {
    const { input, userId } = job.data;
    return this.emailService.sendEmail(input, userId);
  }

  async getScheduledEmails(userId: string) {
    const jobs = await this.emailQueue.getJobs(['delayed']);
    return jobs.filter(job => job.data.userId === userId);
  }

  async cancelScheduledEmail(jobId: string, userId: string) {
    const job = await this.emailQueue.getJob(jobId);
    if (!job) {
      throw new Error('Scheduled email not found');
    }

    if (job.data.userId !== userId) {
      throw new Error('Unauthorized to cancel this email');
    }

    await job.remove();
    return { success: true };
  }
} 