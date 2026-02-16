/**
 * Fails when runtime logger payloads bypass structured serializer.
 *
 * Why:
 * - enforce structured logger event contracts across backend runtime sources
 * - keep PII-redaction and request-correlation behavior consistent
 */
const { spawnSync } = require('child_process');

const loggerCallPrefixPattern =
  '(?:\\bthis\\.|\\blogger\\.|\\b[A-Za-z_$][\\w$]*[Ll]ogger\\.)';

function runRipgrep(commandArgs) {
  return spawnSync('rg', commandArgs, {
    cwd: process.cwd(),
    encoding: 'utf-8',
  });
}

const loggerBypassSerializerResult = runRipgrep([
  '--pcre2',
  '--line-number',
  '--multiline',
  `${loggerCallPrefixPattern}(log|warn|error|debug|verbose|fatal)\\((?!\\s*serializeStructuredLog\\()`,
  'src',
  '--glob',
  '*.ts',
  '--glob',
  '!**/*.spec.ts',
  '--glob',
  '!**/*.d.ts',
]);

if (![0, 1].includes(loggerBypassSerializerResult.status || 0)) {
  console.error(
    '[structured-logger-check] Failed while scanning logger serializer usage.',
  );
  if (loggerBypassSerializerResult.error) {
    console.error(loggerBypassSerializerResult.error.message);
  }
  if (loggerBypassSerializerResult.stderr) {
    process.stderr.write(loggerBypassSerializerResult.stderr);
  }
  process.exit(loggerBypassSerializerResult.status || 2);
}

const loggerJsonStringifyResult = runRipgrep([
  '--pcre2',
  '--line-number',
  '--multiline',
  `${loggerCallPrefixPattern}(log|warn|error|debug|verbose|fatal)\\(\\s*JSON\\.stringify\\(`,
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

const hasBypassSerializerLoggerCalls = loggerBypassSerializerResult.status === 0;
const hasJsonStringifyLoggerCalls = loggerJsonStringifyResult.status === 0;

if (!hasBypassSerializerLoggerCalls && !hasJsonStringifyLoggerCalls) {
  console.log(
    '[structured-logger-check] OK: all runtime logger payloads are serialized.',
  );
  process.exit(0);
}

console.error(
  '[structured-logger-check] Logger payloads bypassing structured serializer detected in runtime sources:',
);
if (hasBypassSerializerLoggerCalls) {
  process.stderr.write(loggerBypassSerializerResult.stdout || '');
}
if (hasJsonStringifyLoggerCalls) {
  process.stderr.write(loggerJsonStringifyResult.stdout || '');
}
process.exit(1);
