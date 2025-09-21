import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { DataSource } from 'typeorm';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService, private readonly dataSource: DataSource) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  async health(): Promise<{ status: string; db: boolean }> {
    try {
      await this.dataSource.query('SELECT 1');
      return { status: 'ok', db: true };
    } catch {
      return { status: 'ok', db: false };
    }
  }
}
