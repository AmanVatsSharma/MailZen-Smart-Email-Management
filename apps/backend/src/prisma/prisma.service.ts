import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    try {
      console.log('[PrismaService] Connecting to database...');
      await this.$connect();
      console.log('[PrismaService] Database connection established.');
    } catch (err) {
      // Loud, actionable error to reduce debugging time.
      console.error('[PrismaService] Failed to connect to database.');
      console.error('[PrismaService] Check `apps/backend/.env` -> DATABASE_URL, and ensure Postgres is running.');
      console.error(err);
      throw err;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
} 