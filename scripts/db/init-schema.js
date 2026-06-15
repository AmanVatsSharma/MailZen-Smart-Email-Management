/**
 * scripts/db/init-schema.js
 *
 * Drop-in schema initializer for local dev. Uses TypeORM's schema synchronization
 * to create all entity tables directly — no migrations needed (this is the dev path
 * the backend's `synchronize: true` would have taken at boot).
 *
 * Bypasses the refactor's TypeScript type errors by using ts-node in transpile-only
 * mode. Safe to re-run; TypeORM's synchronize handles existing tables.
 *
 * Usage:  node scripts/db/init-schema.js
 */

require('reflect-metadata');
require('dotenv').config({ path: process.env.TYPEORM_ENV_FILE || '.env' });

// Force transpile-only mode for ts-node
process.env.TS_NODE_TRANSPILE_ONLY = 'true';

const { DataSource } = require('typeorm');
const path = require('path');

// Load entity registry + connection config
const { ALL_ORM_ENTITIES } = require('../../apps/backend/src/core/infrastructure/persistence/typeorm/typeorm.config.ts');
const { buildTypeOrmOptions } = require('../../apps/backend/src/core/infrastructure/persistence/typeorm/typeorm.config.ts');

const ds = new DataSource({
  ...buildTypeOrmOptions(process.env),
  entities: ALL_ORM_ENTITIES,
  synchronize: true,  // dev-only: auto-create schema
  logging: ['error', 'warn', 'migration'],
});

(async () => {
  try {
    console.log('→ Connecting with synchronize=true…');
    await ds.initialize();
    console.log('✓ Schema synchronized. Tables created from entity definitions.');
    const tables = await ds.query(
      `SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename;`
    );
    console.log(`\nTables (${tables.length}):`);
    for (const t of tables) console.log('  •', t.tablename);
    await ds.destroy();
  } catch (err) {
    console.error('✗ Schema init failed:', err.message);
    process.exit(1);
  }
})();
