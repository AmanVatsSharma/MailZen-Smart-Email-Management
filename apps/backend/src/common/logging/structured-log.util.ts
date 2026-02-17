import { createHash, randomUUID } from 'crypto';

const REDACTED_VALUE = '[REDACTED]';
const MAX_STRING_LENGTH = 512;
const MAX_RECURSION_DEPTH = 6;

const SENSITIVE_KEY_MATCHERS: RegExp[] = [
  /password/i,
  /token/i,
  /secret/i,
  /authorization/i,
  /cookie/i,
  /signature/i,
  /email/i,
  /subject/i,
  /snippet/i,
  /messageid/i,
  /body/i,
  /sourceip/i,
  /^ip$/i,
  /clientidentifier/i,
];

const SAFE_KEY_ALLOWLIST = new Set([
  'requestid',
  'userid',
  'workspaceid',
  'mailboxid',
  'emailid',
  'signaturevalidated',
  'statuscode',
  'durationms',
  'latencyms',
  'event',
]);

type RedactContext = {
  key: string;
  depth: number;
  seen: WeakSet<object>;
};

function normalizeKey(input: string): string {
  return input.replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function isSensitiveKey(key: string): boolean {
  const normalized = normalizeKey(key);
  if (!normalized) return false;
  if (SAFE_KEY_ALLOWLIST.has(normalized)) return false;
  return SENSITIVE_KEY_MATCHERS.some((matcher) => matcher.test(normalized));
}

function truncateStringValue(input: string): string {
  if (input.length <= MAX_STRING_LENGTH) return input;
  const remaining = input.length - MAX_STRING_LENGTH;
  return `${input.slice(0, MAX_STRING_LENGTH)}...[truncated:${remaining}]`;
}

function redactInternal(value: unknown, context: RedactContext): unknown {
  if (context.depth > MAX_RECURSION_DEPTH) return '[MAX_DEPTH]';
  if (value === null || value === undefined) return value;

  const shouldRedact = isSensitiveKey(context.key);
  if (shouldRedact) return REDACTED_VALUE;

  if (typeof value === 'string') return truncateStringValue(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return value.toString();

  if (Array.isArray(value)) {
    return value.map((entry) =>
      redactInternal(entry, {
        ...context,
        depth: context.depth + 1,
      }),
    );
  }

  if (typeof value === 'object') {
    if (context.seen.has(value)) return '[CIRCULAR]';
    context.seen.add(value);

    const result: Record<string, unknown> = {};
    for (const [entryKey, entryValue] of Object.entries(value)) {
      result[entryKey] = redactInternal(entryValue, {
        key: entryKey,
        depth: context.depth + 1,
        seen: context.seen,
      });
    }
    return result;
  }

  if (typeof value === 'symbol') return value.toString();
  if (typeof value === 'function') return '[FUNCTION]';
  return '[UNSERIALIZABLE]';
}

export function redactStructuredLogPayload(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  return redactInternal(payload, {
    key: 'root',
    depth: 0,
    seen: new WeakSet(),
  }) as Record<string, unknown>;
}

export function serializeStructuredLog(
  payload: Record<string, unknown>,
): string {
  return JSON.stringify(redactStructuredLogPayload(payload));
}

export function resolveCorrelationId(
  input: string | string[] | undefined,
): string {
  const rawValue = Array.isArray(input) ? input[0] : input;
  const normalized = String(rawValue || '').trim();
  if (normalized) return normalized;
  return randomUUID();
}

export function fingerprintIdentifier(input: string): string {
  return createHash('sha256').update(input).digest('hex').slice(0, 16);
}
