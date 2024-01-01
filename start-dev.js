const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Function to start a process
function startProcess(name, command, args, cwd) {
  console.log(`Starting ${name}...`);
  
  const process = spawn(command, args, {
    cwd,
    shell: true,
    stdio: 'pipe',
  });

  process.stdout.on('data', (data) => {
    console.log(`[${name}] ${data.toString().trim()}`);
  });

  process.stderr.on('data', (data) => {
    console.error(`[${name}] ${data.toString().trim()}`);
  });

  process.on('close', (code) => {
    console.log(`${name} process exited with code ${code}`);
  });

  return process;
}

// Check if .env files exist, create them if they don't
const backendEnvPath = path.join(__dirname, 'backend', '.env');
const frontendEnvPath = path.join(__dirname, 'frontend', '.env.local');

if (!fs.existsSync(backendEnvPath)) {
  console.log('Creating backend .env file...');
  const backendEnvContent = `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/mailzen?schema=public

# Server Configuration
PORT=4000
NODE_ENV=development

# Frontend URL for CORS
FRONTEND_URL=http://localhost:3000

# JWT Secret for Authentication
JWT_SECRET=YOUR_SECRET_KEY_HERE
JWT_EXPIRATION=86400

# Feature Flags (should match frontend)
ENABLE_EMAIL_WARMUP=true
ENABLE_SMART_REPLIES=true
ENABLE_EMAIL_TRACKING=true`;

  fs.writeFileSync(backendEnvPath, backendEnvContent);
}

if (!fs.existsSync(frontendEnvPath)) {
  console.log('Creating frontend .env.local file...');
  const frontendEnvContent = `# API Endpoints
NEXT_PUBLIC_GRAPHQL_ENDPOINT=http://localhost:4000/graphql

# Authentication
NEXT_PUBLIC_AUTH_ENABLED=true

# Feature Flags
NEXT_PUBLIC_ENABLE_EMAIL_WARMUP=true
NEXT_PUBLIC_ENABLE_SMART_REPLIES=true
NEXT_PUBLIC_ENABLE_EMAIL_TRACKING=true

# UI Configuration
NEXT_PUBLIC_DEFAULT_THEME=system`;

  fs.writeFileSync(frontendEnvPath, frontendEnvContent);
}

// Start backend
const backend = startProcess(
  'Backend',
  'npm',
  ['run', 'start:dev'],
  path.join(__dirname, 'backend')
);

// Start frontend
const frontend = startProcess(
  'Frontend',
  'npm',
  ['run', 'dev'],
  path.join(__dirname, 'frontend')
);

// Handle process termination
process.on('SIGINT', () => {
  console.log('Shutting down...');
  backend.kill();
  frontend.kill();
  process.exit(0);
}); 