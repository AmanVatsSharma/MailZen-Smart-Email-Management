/**
 * Fails when raw logger string payloads are introduced.
 *
 * Why:
 * - enforce structured logger event contracts across backend runtime sources
 * - keep PII-redaction and request-correlation behavior consistent
 */
const { spawnSync } = require('child_process');

function runRipgrep(commandArgs) {
  return spawnSync('rg', commandArgs, {
    cwd: process.cwd(),
    encoding: 'utf-8',
  });
}

const loggerLiteralPatternResult = runRipgrep([
  '--line-number',
  '--multiline',
  'logger\\.(log|warn|error|debug)\\(\\s*[`"\']',
  'src',
  '--glob',
  '*.ts',
  '--glob',
  '!**/*.spec.ts',
  '--glob',
  '!**/*.d.ts',
]);

if (![0, 1].includes(loggerLiteralPatternResult.status || 0)) {
  console.error(
    '[structured-logger-check] Failed while scanning logger literal calls.',
  );
  if (loggerLiteralPatternResult.error) {
    console.error(loggerLiteralPatternResult.error.message);
  }
  if (loggerLiteralPatternResult.stderr) {
    process.stderr.write(loggerLiteralPatternResult.stderr);
  }
  process.exit(loggerLiteralPatternResult.status || 2);
}

const loggerJsonStringifyResult = runRipgrep([
  '--line-number',
  '--multiline',
  'logger\\.(log|warn|error|debug)\\(\\s*JSON\\.stringify\\(',
  'src',
  '--glob',
  '*.ts',
  '--glob',
  '!**/*.spec.ts',
  '--glob',
  '!**/*.d.ts',
]);

if (![0, 1].includes(loggerJsonStringifyResult.status || 0)) {
  console.error(
    '[structured-logger-check] Failed while scanning logger JSON.stringify calls.',
  );
  if (loggerJsonStringifyResult.error) {
    console.error(loggerJsonStringifyResult.error.message);
  }
  if (loggerJsonStringifyResult.stderr) {
    process.stderr.write(loggerJsonStringifyResult.stderr);
  }
  process.exit(loggerJsonStringifyResult.status || 2);
}

const hasLiteralLoggerCalls = loggerLiteralPatternResult.status === 0;
const hasJsonStringifyLoggerCalls = loggerJsonStringifyResult.status === 0;

if (!hasLiteralLoggerCalls && !hasJsonStringifyLoggerCalls) {
  console.log(
    '[structured-logger-check] OK: no raw logger literals or JSON.stringify payloads found.',
  );
  process.exit(0);
}

console.error(
  '[structured-logger-check] Unstructured logger usage detected in runtime sources:',
);
if (hasLiteralLoggerCalls) {
  process.stderr.write(loggerLiteralPatternResult.stdout || '');
}
if (hasJsonStringifyLoggerCalls) {
  process.stderr.write(loggerJsonStringifyResult.stdout || '');
}
process.exit(1);
