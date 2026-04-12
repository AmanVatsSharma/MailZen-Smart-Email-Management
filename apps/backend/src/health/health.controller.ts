import { Controller, Get } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

interface HealthStatus {
  status: 'ok' | 'degraded';
  timestamp: string;
  uptime: number;
  version: string;
  checks: {
    database: 'ok' | 'error';
  };
}

@Controller('health')
export class HealthController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  @Get()
  async check(): Promise<HealthStatus> {
    let dbStatus: 'ok' | 'error' = 'error';
    try {
      await this.dataSource.query('SELECT 1');
      dbStatus = 'ok';
    } catch {
      dbStatus = 'error';
    }

    const overall: 'ok' | 'degraded' = dbStatus === 'ok' ? 'ok' : 'degraded';

    return {
      status: overall,
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      version: process.env.npm_package_version ?? '0.0.0',
      checks: {
        database: dbStatus,
      },
    };
  }
}
