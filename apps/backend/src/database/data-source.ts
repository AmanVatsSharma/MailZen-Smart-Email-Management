/**
 * File: apps/backend/src/database/data-source.ts
 * Module: database
 * Purpose: TypeORM DataSource entrypoint for migration commands.
 * Author: Aman Sharma / Novologic/ Codex
 * Last-updated: 2026-02-14
 * Notes:
 * - Loads backend .env before creating the DataSource
 * - Forces synchronize=false for CLI-driven schema lifecycle
 */
import 'reflect-metadata';
import { config as loadEnvironment } from 'dotenv';
import { DataSource } from 'typeorm';
import { buildDataSourceOptionsFromEnv } from './typeorm.config';

loadEnvironment({ path: process.env.TYPEORM_ENV_FILE || '.env' });

const appDataSource = new DataSource({
  ...buildDataSourceOptionsFromEnv(process.env),
  synchronize: false,
});

export default appDataSource;
