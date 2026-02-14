/**
 * File: apps/backend/src/database/typeorm.config.ts
 * Module: database
 * Purpose: Centralized TypeORM runtime and CLI configuration helpers.
 * Author: Aman Sharma / Novologic/ Codex
 * Last-updated: 2026-02-14
 * Notes:
 * - Enforces local-development-only schema synchronization
 * - Shared by Nest runtime module config and TypeORM CLI DataSource
 */
import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { join } from 'path';
import { DataSourceOptions } from 'typeorm';

const LOCAL_NODE_ENVS = new Set(['development', 'dev', 'local']);
const TRUTHY_VALUES = new Set(['1', 'true', 'yes', 'on']);
const FALSY_VALUES = new Set(['0', 'false', 'no', 'off']);

const normalize = (value?: string): string => (value ?? '').trim().toLowerCase();

const parseBoolean = (
  value: string | undefined,
  defaultValue: boolean,
): boolean => {
  const normalized = normalize(value);
  if (!normalized) return defaultValue;
  if (TRUTHY_VALUES.has(normalized)) return true;
  if (FALSY_VALUES.has(normalized)) return false;
  return defaultValue;
};

const parsePositiveInt = (
  value: string | undefined,
  fallback: number,
): number => {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
};

export const isLocalDevelopmentEnvironment = (
  env: NodeJS.ProcessEnv,
): boolean => {
  const nodeEnv = normalize(env.NODE_ENV || 'development');
  const isCi = parseBoolean(env.CI, false);
  return LOCAL_NODE_ENVS.has(nodeEnv) && !isCi;
};

export const shouldSynchronizeSchema = (env: NodeJS.ProcessEnv): boolean => {
  if (!isLocalDevelopmentEnvironment(env)) return false;
  return parseBoolean(env.TYPEORM_SYNCHRONIZE, true);
};

const resolveTypeOrmPaths = () => ({
  entities: [join(__dirname, '..', '**', '*.entity.{ts,js}')],
  migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
});

const resolveEnvironmentForTypeOrm = (
  configService?: ConfigService,
): NodeJS.ProcessEnv => {
  if (!configService) return process.env;
  return {
    ...process.env,
    DATABASE_URL: configService.getOrThrow<string>('DATABASE_URL'),
    NODE_ENV: configService.get<string>('NODE_ENV') ?? process.env.NODE_ENV,
    CI: configService.get<string>('CI') ?? process.env.CI,
    TYPEORM_SYNCHRONIZE:
      configService.get<string>('TYPEORM_SYNCHRONIZE') ??
      process.env.TYPEORM_SYNCHRONIZE,
    TYPEORM_RUN_MIGRATIONS:
      configService.get<string>('TYPEORM_RUN_MIGRATIONS') ??
      process.env.TYPEORM_RUN_MIGRATIONS,
    TYPEORM_POOL_MAX:
      configService.get<string>('TYPEORM_POOL_MAX') ??
      process.env.TYPEORM_POOL_MAX,
    TYPEORM_IDLE_TIMEOUT_MS:
      configService.get<string>('TYPEORM_IDLE_TIMEOUT_MS') ??
      process.env.TYPEORM_IDLE_TIMEOUT_MS,
  };
};

export const buildDataSourceOptionsFromEnv = (
  env: NodeJS.ProcessEnv,
): DataSourceOptions => {
  if (!env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required for TypeORM initialization.');
  }

  const synchronize = shouldSynchronizeSchema(env);
  const migrationsRun = parseBoolean(
    env.TYPEORM_RUN_MIGRATIONS,
    !synchronize,
  );
  const { entities, migrations } = resolveTypeOrmPaths();

  return {
    type: 'postgres',
    url: env.DATABASE_URL,
    synchronize,
    logging: ['error'],
    entities,
    migrations,
    migrationsTableName: 'typeorm_migrations',
    migrationsRun,
    migrationsTransactionMode: 'each',
    extra: {
      max: parsePositiveInt(env.TYPEORM_POOL_MAX, 10),
      idleTimeoutMillis: parsePositiveInt(env.TYPEORM_IDLE_TIMEOUT_MS, 30000),
    },
  };
};

export const buildTypeOrmModuleOptions = (
  configService: ConfigService,
): TypeOrmModuleOptions => {
  const env = resolveEnvironmentForTypeOrm(configService);
  const baseOptions = buildDataSourceOptionsFromEnv(env);

  return {
    ...baseOptions,
    autoLoadEntities: true,
  };
};
