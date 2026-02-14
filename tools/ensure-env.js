/**
 * MailZen - Environment bootstrapper
 *
 * Why this exists:
 * - Previously, `start-dev.js` created default env files on first run.
 * - After Nx migration, we keep that behavior by running this script as an Nx
 *   dependency (`prepare-env`) before `serve` / `build`.
 *
 * Design goals:
 * - Conservative: ONLY create files if they do not exist (never overwrite).
 * - Loud: console logs everywhere for easy debugging later.
 * - Robust: explicit exit codes, clear errors, safe filesystem operations.
 *
 * Usage:
 *   node tools/ensure-env.js --project backend
 *   node tools/ensure-env.js --project frontend
 *   node tools/ensure-env.js --project all
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Parse CLI args of the form `--key value` or `--flag`.
 * @returns {Record<string, string|boolean>}
 */
function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
      continue;
    }
    args[key] = next;
    i += 1;
  }
  return args;
}

/**
 * Ensure a file exists. If missing, create parent dirs and write content.
 * Never overwrites existing files.
 *
 * @param {string} filePath
 * @param {string} content
 */
function ensureFile(filePath, content) {
  try {
    if (fs.existsSync(filePath)) {
      console.log(`[ensure-env] OK: already exists: ${filePath}`);
      return;
    }

    const dir = path.dirname(filePath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, content, { encoding: 'utf8', flag: 'wx' }); // wx = fail if exists
    console.log(`[ensure-env] CREATED: ${filePath}`);
  } catch (err) {
    console.error(`[ensure-env] ERROR creating ${filePath}`);
    console.error(err);
    process.exitCode = 1;
  }
}

// ---- Default templates (kept in sync with old start-dev.js) ----
/**
 * Generate backend env content.
 *
 * IMPORTANT:
 * - We generate a strong JWT secret by default so the backend can boot safely.
 * - You can rotate it any time; existing JWTs become invalid (expected).
 */
function buildBackendEnvTemplate() {
  const generatedJwtSecret = crypto.randomBytes(48).toString('hex'); // 96 chars
  return `# Database
# - Fedora/Ubuntu local Postgres often uses peer auth via unix socket:
#     postgresql:///mailzen?host=/var/run/postgresql
# - Docker/local password auth often uses TCP:
#     postgresql://postgres:postgres@localhost:5432/mailzen
DATABASE_URL=postgresql:///mailzen?host=/var/run/postgresql

# Server Configuration
PORT=4000
NODE_ENV=development

# Frontend URL for CORS
FRONTEND_URL=http://localhost:3000

# JWT Secret for Authentication
JWT_SECRET=${generatedJwtSecret}
JWT_EXPIRATION=86400

# Feature Flags (should match frontend)
ENABLE_EMAIL_WARMUP=true
ENABLE_SMART_REPLIES=true
ENABLE_EMAIL_TRACKING=true

# SMTP Configuration (for sending)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=

# Redis Configuration (for Bull queues)
REDIS_HOST=localhost
REDIS_PORT=6379

# Google Cloud Storage (for attachments)
GOOGLE_CLOUD_STORAGE_BUCKET=
GOOGLE_CLOUD_PROJECT_ID=
GOOGLE_CLOUD_KEYFILE=
`;
}

const frontendEnvTemplate = `# API Endpoints
NEXT_PUBLIC_GRAPHQL_ENDPOINT=http://localhost:4000/graphql

# Authentication
NEXT_PUBLIC_AUTH_ENABLED=true

# Feature Flags
NEXT_PUBLIC_ENABLE_EMAIL_WARMUP=true
NEXT_PUBLIC_ENABLE_SMART_REPLIES=true
NEXT_PUBLIC_ENABLE_EMAIL_TRACKING=true

# UI Configuration
NEXT_PUBLIC_DEFAULT_THEME=system
`;

function main() {
  const repoRoot = process.cwd();
  const args = parseArgs(process.argv);

  const project = String(args.project || '').toLowerCase();
  if (!project) {
    console.error('[ensure-env] Missing required arg: --project <frontend|backend|all>');
    process.exit(2);
  }

  console.log(`[ensure-env] repoRoot=${repoRoot}`);
  console.log(`[ensure-env] project=${project}`);

  // Nx standard apps layout
  const backendEnvPath = path.join(repoRoot, 'apps', 'backend', '.env');
  const frontendEnvPath = path.join(repoRoot, 'apps', 'frontend', '.env.local');

  if (project === 'backend' || project === 'all') {
    ensureFile(backendEnvPath, buildBackendEnvTemplate());
  }

  if (project === 'frontend' || project === 'all') {
    ensureFile(frontendEnvPath, frontendEnvTemplate);
  }

  if (process.exitCode && process.exitCode !== 0) {
    console.error('[ensure-env] Completed with errors.');
    process.exit(process.exitCode);
  }

  console.log('[ensure-env] Done.');
}

main();

