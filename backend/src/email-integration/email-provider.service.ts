import { Injectable, NotFoundException, BadRequestException, ConflictException, InternalServerErrorException, Logger } from '@nestjs/common';
import { EmailProviderInput } from './dto/email-provider.input';
import { PrismaService } from '../prisma/prisma.service';
import { createTransport, Transporter } from 'nodemailer';
import * as NodeCache from 'node-cache';
import { OAuth2Client } from 'google-auth-library';
import axios from 'axios';

interface SmtpConnectionPool {
  [key: string]: {
    transporter: Transporter;
    lastUsed: Date;
  }
}

@Injectable()
export class EmailProviderService {
  private readonly logger = new Logger(EmailProviderService.name);
  private readonly googleOAuth2Client: OAuth2Client;
  private readonly smtpConnectionPool: SmtpConnectionPool = {};
  private readonly connectionCache = new NodeCache({ stdTTL: 3600, checkperiod: 600 }); // 1 hour TTL, check every 10 minutes
  
  constructor(private prisma: PrismaService) {
    // Setup Google OAuth client
    this.googleOAuth2Client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    
    // Start connection pool cleanup interval
    setInterval(() => this.cleanupConnectionPool(), 15 * 60 * 1000); // Run every 15 minutes
  }

  async configureProvider(config: EmailProviderInput, userId: string) {
    try {
      // Auto-detect provider type if requested
      if (config.autoDetect && config.email) {
        config.providerType = this.detectProviderType(config.email);
      }
      
      // Check if provider already exists
      const existingProvider = await this.prisma.emailProvider.findFirst({
        where: {
          email: config.email,
          type: config.providerType,
          userId
        }
      });

      if (existingProvider) {
        throw new ConflictException(`Provider ${config.providerType} with email ${config.email} already exists`);
      }
      
      switch (config.providerType) {
        case 'GMAIL':
          return this.configureGmail(config, userId);
        case 'OUTLOOK':
          return this.configureOutlook(config, userId);
        case 'CUSTOM_SMTP':
          return this.configureSmtp(config, userId);
        default:
          throw new BadRequestException(`Unsupported provider type: ${config.providerType}`);
      }
    } catch (error) {
      this.logger.error(`Failed to configure provider: ${error.message}`, error.stack);
      if (error instanceof BadRequestException || 
          error instanceof ConflictException || 
          error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to configure email provider');
    }
  }

  private detectProviderType(email: string): string {
    const domain = email.split('@')[1].toLowerCase();
    
    if (domain === 'gmail.com') {
      return 'GMAIL';
    } else if (domain === 'outlook.com' || domain === 'hotmail.com' || domain === 'live.com') {
      return 'OUTLOOK';
    } else {
      return 'CUSTOM_SMTP';
    }
  }

  private async configureGmail(config: EmailProviderInput, userId: string) {
    if (!config.accessToken) {
      throw new BadRequestException('Access token is required for Gmail providers');
    }
    
    try {
      return await this.prisma.emailProvider.create({
        data: {
          type: 'GMAIL',
          email: config.email,
          accessToken: config.accessToken,
          refreshToken: config.refreshToken,
          tokenExpiry: config.tokenExpiry ? new Date(config.tokenExpiry) : null,
          user: {
            connect: {
              id: userId
            }
          }
        }
      });
    } catch (error) {
      this.logger.error(`Failed to configure Gmail provider: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to configure Gmail provider');
    }
  }

  private async configureOutlook(config: EmailProviderInput, userId: string) {
    if (!config.accessToken) {
      throw new BadRequestException('Access token is required for Outlook providers');
    }
    
    try {
      return await this.prisma.emailProvider.create({
        data: {
          type: 'OUTLOOK',
          email: config.email,
          accessToken: config.accessToken,
          refreshToken: config.refreshToken,
          tokenExpiry: config.tokenExpiry ? new Date(config.tokenExpiry) : null,
          user: {
            connect: {
              id: userId
            }
          }
        }
      });
    } catch (error) {
      this.logger.error(`Failed to configure Outlook provider: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to configure Outlook provider');
    }
  }

  private async configureSmtp(config: EmailProviderInput, userId: string) {
    if (!config.host || !config.port || !config.password) {
      throw new BadRequestException('Host, port, and password are required for SMTP providers');
    }

    try {
      return await this.prisma.emailProvider.create({
        data: {
          type: 'CUSTOM_SMTP',
          email: config.email,
          host: config.host,
          port: config.port,
          password: config.password,
          user: {
            connect: {
              id: userId
            }
          }
        }
      });
    } catch (error) {
      this.logger.error(`Failed to configure SMTP provider: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to configure SMTP provider');
    }
  }

  async getProviderEmails(providerId: string, userId: string) {
    try {
      const provider = await this.prisma.emailProvider.findFirst({
        where: { 
          id: providerId,
          userId
        },
        include: { emails: true }
      });

      if (!provider) {
        throw new NotFoundException(`Provider with ID ${providerId} not found`);
      }

      return provider.emails;
    } catch (error) {
      this.logger.error(`Failed to get provider emails: ${error.message}`, error.stack);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to get provider emails');
    }
  }

  async getAllProviders(userId: string) {
    try {
      return await this.prisma.emailProvider.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' }
      });
    } catch (error) {
      this.logger.error(`Failed to get all providers: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to get email providers');
    }
  }

  async getProviderById(id: string, userId: string) {
    try {
      const provider = await this.prisma.emailProvider.findFirst({
        where: { 
          id,
          userId 
        }
      });

      if (!provider) {
        throw new NotFoundException(`Provider with ID ${id} not found`);
      }

      return provider;
    } catch (error) {
      this.logger.error(`Failed to get provider: ${error.message}`, error.stack);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to get email provider');
    }
  }

  async deleteProvider(id: string, userId: string) {
    try {
      // First verify that the provider exists and belongs to the user
      const provider = await this.prisma.emailProvider.findFirst({
        where: { 
          id,
          userId 
        }
      });

      if (!provider) {
        throw new NotFoundException(`Provider with ID ${id} not found`);
      }

      // Clean up from connection pool if it exists
      this.removeFromConnectionPool(id);

      // Delete the provider
      await this.prisma.emailProvider.delete({
        where: { id }
      });

      return true;
    } catch (error) {
      this.logger.error(`Failed to delete provider: ${error.message}`, error.stack);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to delete email provider');
    }
  }

  async updateProviderCredentials(id: string, updatedData: Partial<EmailProviderInput>, userId: string) {
    try {
      // First verify that the provider exists and belongs to the user
      const provider = await this.prisma.emailProvider.findFirst({
        where: { 
          id,
          userId 
        }
      });

      if (!provider) {
        throw new NotFoundException(`Provider with ID ${id} not found`);
      }

      // Remove from connection pool to refresh with new credentials
      this.removeFromConnectionPool(id);

      // Prepare update data based on provider type
      const updateData = {};
      
      if (provider.type === 'CUSTOM_SMTP') {
        if (updatedData.host) updateData['host'] = updatedData.host;
        if (updatedData.port) updateData['port'] = updatedData.port;
        if (updatedData.password) updateData['password'] = updatedData.password;
      } else if (['GMAIL', 'OUTLOOK'].includes(provider.type)) {
        if (updatedData.accessToken) updateData['accessToken'] = updatedData.accessToken;
        if (updatedData.refreshToken) updateData['refreshToken'] = updatedData.refreshToken;
        if (updatedData.tokenExpiry) updateData['tokenExpiry'] = new Date(updatedData.tokenExpiry);
      }

      // Update the provider
      return await this.prisma.emailProvider.update({
        where: { id },
        data: updateData
      });
    } catch (error) {
      this.logger.error(`Failed to update provider credentials: ${error.message}`, error.stack);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to update email provider credentials');
    }
  }

  async validateProvider(id: string, userId: string) {
    try {
      const provider = await this.getProviderById(id, userId);
      
      // Try to get or create a transporter
      const transporter = await this.getTransporter(provider);
      
      // Verify connection
      const verifyResult = await transporter.verify();
      
      return {
        valid: !!verifyResult,
        message: 'Provider connection validated successfully'
      };
    } catch (error) {
      this.logger.error(`Provider validation failed: ${error.message}`, error.stack);
      return {
        valid: false,
        message: error.message || 'Provider validation failed'
      };
    }
  }
  
  async getTransporter(provider: any): Promise<Transporter> {
    const cacheKey = `transporter_${provider.id}`;
    
    // Check if we have a cached transporter
    if (this.connectionCache.has(cacheKey)) {
      return this.smtpConnectionPool[provider.id].transporter;
    }
    
    // If not in cache, check if we need to refresh OAuth token
    if (['GMAIL', 'OUTLOOK'].includes(provider.type) && provider.tokenExpiry) {
      const now = new Date();
      const expiry = new Date(provider.tokenExpiry);
      
      // If token is expired or about to expire (within 5 minutes), refresh it
      if (expiry <= new Date(now.getTime() + 5 * 60 * 1000)) {
        await this.refreshOAuthToken(provider);
      }
    }
    
    // Create a new transporter based on provider type
    let transporterConfig;
    let transporter;
    
    switch (provider.type) {
      case 'GMAIL':
        transporterConfig = {
          service: 'gmail',
          auth: {
            type: 'OAuth2',
            user: provider.email,
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            accessToken: provider.accessToken,
            refreshToken: provider.refreshToken,
            expires: provider.tokenExpiry ? new Date(provider.tokenExpiry).getTime() : undefined
          }
        };
        break;
      case 'OUTLOOK':
        transporterConfig = {
          service: 'outlook',
          auth: {
            type: 'OAuth2',
            user: provider.email,
            clientId: process.env.OUTLOOK_CLIENT_ID,
            clientSecret: process.env.OUTLOOK_CLIENT_SECRET,
            accessToken: provider.accessToken,
            refreshToken: provider.refreshToken,
            expires: provider.tokenExpiry ? new Date(provider.tokenExpiry).getTime() : undefined
          }
        };
        break;
      case 'CUSTOM_SMTP':
        transporterConfig = {
          host: provider.host,
          port: provider.port,
          secure: provider.port === 465,
          auth: {
            user: provider.email,
            pass: provider.password
          },
          pool: true,
          maxConnections: 5,
          maxMessages: 100
        };
        break;
      default:
        throw new Error(`Unsupported provider type: ${provider.type}`);
    }
    
    transporter = createTransport(transporterConfig);
    
    // Add to connection pool
    this.smtpConnectionPool[provider.id] = {
      transporter,
      lastUsed: new Date()
    };
    
    // Add to cache with TTL
    this.connectionCache.set(cacheKey, true);
    
    return transporter;
  }
  
  private async refreshOAuthToken(provider: any) {
    try {
      if (provider.type === 'GMAIL' && provider.refreshToken) {
        // Refresh Google token
        this.googleOAuth2Client.setCredentials({
          refresh_token: provider.refreshToken
        });
        
        const { credentials } = await this.googleOAuth2Client.refreshAccessToken();
        
        // Update provider with new token info
        await this.prisma.emailProvider.update({
          where: { id: provider.id },
          data: {
            accessToken: credentials.access_token,
            tokenExpiry: credentials.expiry_date ? new Date(credentials.expiry_date) : null
          }
        });
        
        // Update local reference
        provider.accessToken = credentials.access_token;
        provider.tokenExpiry = credentials.expiry_date ? new Date(credentials.expiry_date) : null;
        
      } else if (provider.type === 'OUTLOOK' && provider.refreshToken) {
        // Refresh Microsoft token
        const tokenUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
        const params = new URLSearchParams();
        params.append('client_id', process.env.OUTLOOK_CLIENT_ID || '');
        params.append('client_secret', process.env.OUTLOOK_CLIENT_SECRET || '');
        params.append('grant_type', 'refresh_token');
        params.append('refresh_token', provider.refreshToken);
        
        const response = await axios.post(tokenUrl, params, {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        });
        
        // Update provider with new token info
        const expiryDate = new Date();
        expiryDate.setSeconds(expiryDate.getSeconds() + response.data.expires_in);
        
        await this.prisma.emailProvider.update({
          where: { id: provider.id },
          data: {
            accessToken: response.data.access_token,
            refreshToken: response.data.refresh_token || provider.refreshToken, // Some providers don't return a new refresh token
            tokenExpiry: expiryDate
          }
        });
        
        // Update local reference
        provider.accessToken = response.data.access_token;
        provider.refreshToken = response.data.refresh_token || provider.refreshToken;
        provider.tokenExpiry = expiryDate;
      }
    } catch (error) {
      this.logger.error(`Failed to refresh OAuth token: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to refresh OAuth token');
    }
  }
  
  private cleanupConnectionPool() {
    const now = new Date();
    const idleTimeout = 30 * 60 * 1000; // 30 minutes
    
    for (const [id, connection] of Object.entries(this.smtpConnectionPool)) {
      const idleTime = now.getTime() - connection.lastUsed.getTime();
      
      if (idleTime > idleTimeout) {
        // Close the connection and remove from pool
        connection.transporter.close();
        delete this.smtpConnectionPool[id];
        this.connectionCache.del(`transporter_${id}`);
        this.logger.debug(`Removed idle connection for provider ${id} from pool`);
      }
    }
  }
  
  private removeFromConnectionPool(providerId: string) {
    if (this.smtpConnectionPool[providerId]) {
      this.smtpConnectionPool[providerId].transporter.close();
      delete this.smtpConnectionPool[providerId];
      this.connectionCache.del(`transporter_${providerId}`);
      this.logger.debug(`Removed connection for provider ${providerId} from pool`);
    }
  }
} 