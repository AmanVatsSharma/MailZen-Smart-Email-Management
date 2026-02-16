/**
 * Fails when raw console logging is found in backend runtime sources.
 *
 * Why:
 * - enforce structured logging discipline
 * - avoid accidental PII leakage through ad-hoc console logs
 */
const { spawnSync } = require('child_process');

const command = [
  '--line-number',
  'console\\.(log|info|warn|error|debug|trace)\\(',
  'src',
  '--glob',
  '*.ts',
  '--glob',
  '!**/*.spec.ts',
  '--glob',
  '!**/*.d.ts',
];

const result = spawnSync('rg', command, {
  cwd: process.cwd(),
  encoding: 'utf-8',
});

if (result.status === 1) {
  console.log('[no-console-check] OK: no raw console logging found.');
  process.exit(0);
}

if (result.status === 0) {
  console.error(
    '[no-console-check] Raw console usage detected in runtime sources:',
  );
  process.stderr.write(result.stdout || '');
  process.exit(1);
}

console.error('[no-console-check] Failed to run ripgrep command.');
if (result.error) {
  console.error(result.error.message);
}
if (result.stderr) {
  process.stderr.write(result.stderr);
}
process.exit(result.status || 2);
