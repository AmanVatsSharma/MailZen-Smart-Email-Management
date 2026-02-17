/**
 * Migration contract checks
 *
 * Purpose:
 * - Fail CI early when TypeORM migration wiring drifts.
 * - Verify DataSource is migration-safe (no runtime synchronize).
 * - Ensure migration files are discoverable from repository tree.
 */
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const migrationsDirectory = path.join(projectRoot, 'src/database/migrations');

function fail(message) {
  console.error(`[migration-contract-check] ${message}`);
  process.exit(1);
}

function ensureMigrationFilesExist() {
  if (!fs.existsSync(migrationsDirectory)) {
    fail(`Migrations directory missing: ${migrationsDirectory}`);
  }
  const entries = fs
    .readdirSync(migrationsDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => name.endsWith('.ts') || name.endsWith('.js'));
  if (!entries.length) {
    fail(`No migration files found in ${migrationsDirectory}`);
  }
  console.log(
    `[migration-contract-check] migration file count=${entries.length}`,
  );
}

function loadDataSource() {
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL =
      'postgresql://postgres:postgres@localhost:5432/mailzen_ci?schema=public';
  }
  process.env.TYPEORM_ENV_FILE = process.env.TYPEORM_ENV_FILE || '.env';

  require('ts-node/register/transpile-only');
  require('tsconfig-paths/register');

  const dataSourceModule = require('../src/database/data-source');
  return dataSourceModule.default;
}

function ensureDataSourceContracts(dataSource) {
  if (!dataSource || !dataSource.options) {
    fail('Could not resolve TypeORM DataSource options');
  }
  const options = dataSource.options;
  if (options.type !== 'postgres') {
    fail(`Expected postgres driver, received ${String(options.type)}`);
  }
  if (options.synchronize !== false) {
    fail(
      `Expected synchronize=false for migration safety, received ${String(
        options.synchronize,
      )}`,
    );
  }
  const migrations = Array.isArray(options.migrations) ? options.migrations : [];
  if (!migrations.length) {
    fail('TypeORM DataSource has no configured migration globs');
  }
  console.log(
    `[migration-contract-check] datasource migrations configured=${migrations.length}`,
  );
}

function run() {
  ensureMigrationFilesExist();
  const dataSource = loadDataSource();
  ensureDataSourceContracts(dataSource);
  console.log('[migration-contract-check] OK');
}

run();
