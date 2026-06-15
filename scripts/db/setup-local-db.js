/**
 * scripts/db/setup-local-db.js
 *
 * One-shot local PostgreSQL setup for MailZen.
 * Creates the `mailzen` role + `mailzen` database, verifies the connection,
 * and prints the DATABASE_URL the backend should use.
 *
 * Handles the Windows-specific auth gotcha: temporarily flips pg_hba.conf to
 * trust auth so the superuser can create the role+db without a password,
 * then restores scram-sha-256.
 *
 * Usage:   node scripts/db/setup-local-db.js
 *          node scripts/db/setup-local-db.js --no-flip   # skip pg_hba.conf mutation
 *
 * Requires: psql.exe on disk (auto-detects C:\Program Files\PostgreSQL\*\bin)
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ARGS = process.argv.slice(2);
const SKIP_HBA = ARGS.includes('--no-flip');

const PG = {
  host: process.env.MAILZEN_DB_HOST || 'localhost',
  port: Number(process.env.MAILZEN_DB_PORT || 5432),
  user: process.env.MAILZEN_DB_USER || 'mailzen',
  password: process.env.MAILZEN_DB_PASSWORD || 'mailzen',
  database: process.env.MAILZEN_DB_NAME || 'mailzen',
  superuser: 'postgres',
};

// ---------------------------------------------------------------------------
// Locate psql.exe
// ---------------------------------------------------------------------------
function locatePsql() {
  const candidates = [
    'C:\\Program Files\\PostgreSQL\\17\\bin',
    'C:\\Program Files\\PostgreSQL\\16\\bin',
    'C:\\Program Files\\PostgreSQL\\15\\bin',
    'D:\\Program Files\\PostgreSQL\\17\\bin',
    '/usr/lib/postgresql/17/bin',
    '/usr/local/pgsql/bin',
  ];
  for (const dir of candidates) {
    const exe = path.join(dir, 'psql.exe');
    if (fs.existsSync(exe)) return exe;
    const unix = path.join(dir, 'psql');
    if (fs.existsSync(unix)) return unix;
  }
  // Try PATH
  try {
    execFileSync('psql', ['--version'], { stdio: 'ignore' });
    return 'psql';
  } catch {
    return null;
  }
}

const PSQL = locatePsql();
if (!PSQL) {
  console.error('✗ psql not found. Install PostgreSQL 15/16/17 or set MAILZEN_DB_* env vars.');
  process.exit(1);
}
console.log('→ psql:', PSQL);

// ---------------------------------------------------------------------------
// Helper: run a SQL file / statement via psql
// ---------------------------------------------------------------------------
function psqlExec({ user, database, env, sql, input }) {
  const args = [
    '-h', PG.host,
    '-p', String(PG.port),
    '-U', user,
    '-d', database,
    '-tAc', sql,
  ];
  const proc = require('child_process').spawnFile
    ? require('child_process').spawnFile(PSQL, args, { env: { ...process.env, ...env } })
    : null;

  // Fallback: use execFileSync with env override
  try {
    return execFileSync(PSQL, args, {
      env: { ...process.env, ...env, PGPASSWORD: env.PGPASSWORD || '' },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch (e) {
    return e.stdout ? e.stdout.toString().trim() : '';
  }
}

// ---------------------------------------------------------------------------
// Step 1 — find pg_hba.conf
// ---------------------------------------------------------------------------
const PG_HBA_PATHS = [
  'C:\\Program Files\\PostgreSQL\\17\\data\\pg_hba.conf',
  'C:\\Program Files\\PostgreSQL\\16\\data\\pg_hba.conf',
  'C:\\Program Files\\PostgreSQL\\15\\data\\pg_hba.conf',
];
const PG_HBA = PG_HBA_PATHS.find((p) => fs.existsSync(p));
let hbaBackup = null;

function flipHbaToTrust() {
  if (!PG_HBA || SKIP_HBA) return false;
  hbaBackup = fs.readFileSync(PG_HBA, 'utf8');
  if (!/trust/.test(hbaBackup)) {
    const flipped = hbaBackup
      .split('\n')
      .map((line) =>
        line.match(/^(host|local)\s/) && /scram-sha-256|md5/.test(line)
          ? line.replace(/scram-sha-256|md5/, 'trust')
          : line
      )
      .join('\n');
    fs.writeFileSync(PG_HBA, flipped);
    console.log('  → pg_hba.conf: temporarily flipped to trust auth');
    return true;
  }
  return false;
}

function restoreHba() {
  if (!PG_HBA || !hbaBackup) return;
  fs.writeFileSync(PG_HBA, hbaBackup);
  console.log('  → pg_hba.conf: restored from backup');
}

// ---------------------------------------------------------------------------
// Step 2 — superuser connection (postgres)
// ---------------------------------------------------------------------------
console.log('\n▶ Step 1/4: Superuser connection');
let connOk = false;
try {
  const out = psqlExec({
    user: PG.superuser,
    database: 'postgres',
    sql: 'SELECT 1;',
  });
  connOk = out === '1';
} catch {}

if (!connOk) {
  console.log('  → trust auth required — flipping pg_hba.conf');
  const flipped = flipHbaToTrust();
  if (flipped) {
    console.log('  → please restart PostgreSQL service, then re-run this script');
    console.log('    PowerShell (Admin):  Stop-Service postgresql-x64-17 ; Start-Service postgresql-x64-17');
    process.exit(0);
  }
  // try again
  try {
    const out = psqlExec({ user: PG.superuser, database: 'postgres', sql: 'SELECT 1;' });
    connOk = out === '1';
  } catch {}
}

if (!connOk) {
  console.error('✗ Cannot connect as postgres superuser. Is the service running?');
  process.exit(1);
}
console.log('  ✓ connected');

// ---------------------------------------------------------------------------
// Step 3 — create role
// ---------------------------------------------------------------------------
console.log(`\n▶ Step 2/4: Create role '${PG.user}' (if missing)`);
const roleExists = psqlExec({
  user: PG.superuser,
  database: 'postgres',
  sql: `SELECT 1 FROM pg_roles WHERE rolname='${PG.user}';`,
});
if (roleExists === '1') {
  console.log('  ✓ role already exists — updating password');
  psqlExec({
    user: PG.superuser,
    database: 'postgres',
    sql: `ALTER USER ${PG.user} WITH PASSWORD '${PG.password}';`,
  });
} else {
  psqlExec({
    user: PG.superuser,
    database: 'postgres',
    sql: `CREATE ROLE ${PG.user} WITH LOGIN SUPERUSER PASSWORD '${PG.password}';`,
  });
  console.log('  ✓ role created');
}

// ---------------------------------------------------------------------------
// Step 4 — create database
// ---------------------------------------------------------------------------
console.log(`\n▶ Step 3/4: Create database '${PG.database}' (if missing)`);
const dbExists = psqlExec({
  user: PG.superuser,
  database: 'postgres',
  sql: `SELECT 1 FROM pg_database WHERE datname='${PG.database}';`,
});
if (dbExists === '1') {
  console.log('  ✓ database already exists');
} else {
  psqlExec({
    user: PG.superuser,
    database: 'postgres',
    sql: `CREATE DATABASE ${PG.database} OWNER ${PG.user};`,
  });
  console.log('  ✓ database created');
}

// ---------------------------------------------------------------------------
// Step 5 — restore auth, verify mailzen connection
// ---------------------------------------------------------------------------
console.log(`\n▶ Step 4/4: Verify connection as '${PG.user}'`);
restoreHba();

const verify = psqlExec({
  user: PG.user,
  database: PG.database,
  env: { PGPASSWORD: PG.password },
  sql: `SELECT current_database() || ' | ' || current_user || ' | ' || version();`,
});

if (verify.startsWith(PG.database)) {
  console.log('  ✓', verify);
  console.log('\n✅ PostgreSQL ready.\n');
  console.log('Add to apps/backend/.env:');
  console.log(`  DATABASE_URL=postgresql://${PG.user}:${PG.password}@${PG.host}:${PG.port}/${PG.database}`);
  console.log('  TYPEORM_SYNCHRONIZE=true');
  console.log('\nNext steps:');
  console.log('  1. Boot the backend:  npm run dev:backend');
  console.log('     (TypeORM will auto-create all tables on first boot)');
  console.log('  2. Seed demo data:    cd apps/backend && npm run seed:demo:fresh');
  console.log('     Demo login:  demo@mailzen.dev  /  Demo@1234');
} else {
  console.error('  ✗ Connection failed:', verify);
  console.error('  Try running with:  node scripts/db/setup-local-db.js --no-flip');
  process.exit(1);
}
