process.env.TS_NODE_TRANSPILE_ONLY = 'true';
process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({
  module: 'commonjs',
  target: 'ES2021',
  esModuleInterop: true,
  experimentalDecorators: true,
  emitDecoratorMetadata: true,
  allowSyntheticDefaultImports: true,
  skipLibCheck: true,
});

require('reflect-metadata');
require('dotenv').config();

require('ts-node').register({
  transpileOnly: true,
  compilerOptions: {
    module: 'commonjs',
    target: 'ES2021',
    esModuleInterop: true,
    experimentalDecorators: true,
    emitDecoratorMetadata: true,
    allowSyntheticDefaultImports: true,
    skipLibCheck: true,
  },
});

require('tsconfig-paths').register({ baseUrl: __dirname, paths: {} });

const { DataSource } = require('typeorm');
const path = require('path');

const cfg = require(path.resolve(
  'C:/Users/ASUS TUF A15/Desktop/DevOPS/Workspace/MailZen-Smart-Email-Management/apps/backend/src/core/infrastructure/persistence/typeorm/typeorm.config'
));

const u = new URL(process.env.DATABASE_URL);
const ds = new DataSource({
  type: 'postgres',
  host: u.hostname,
  port: parseInt(u.port || '5432', 10),
  username: u.username,
  password: u.password,
  database: u.pathname.replace(/^\//, ''),
  entities: cfg.ALL_ORM_ENTITIES,
  synchronize: true,
  logging: ['error', 'warn'],
});

(async () => {
  try {
    await ds.initialize();
    console.log('SCHEMA OK');
    const tables = await ds.query(
      "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename;"
    );
    console.log('TABLES: ' + tables.length);
    for (const t of tables) console.log('  - ' + t.tablename);
    await ds.destroy();
  } catch (err) {
    console.error('FAIL:', err.message);
    process.exit(1);
  }
})();
