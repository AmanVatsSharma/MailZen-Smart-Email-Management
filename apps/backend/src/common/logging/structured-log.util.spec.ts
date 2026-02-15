import {
  fingerprintIdentifier,
  redactStructuredLogPayload,
  resolveCorrelationId,
  serializeStructuredLog,
} from './structured-log.util';

describe('structured-log.util', () => {
  it('redacts sensitive keys recursively', () => {
    const payload = redactStructuredLogPayload({
      event: 'test_event',
      requestId: 'req-1',
      userEmail: 'founder@mailzen.com',
      nested: {
        accessToken: 'secret-token',
        safeValue: 'ok',
      },
      messages: [
        {
          messageId: '<msg-1>',
          count: 2,
        },
      ],
    });

    expect(payload).toEqual({
      event: 'test_event',
      requestId: 'req-1',
      userEmail: '[REDACTED]',
      nested: {
        accessToken: '[REDACTED]',
        safeValue: 'ok',
      },
      messages: [
        {
          messageId: '[REDACTED]',
          count: 2,
        },
      ],
    });
  });

  it('preserves provided correlation id and generates fallback when absent', () => {
    expect(resolveCorrelationId('req-abc')).toBe('req-abc');
    expect(resolveCorrelationId([' req-array '])).toBe('req-array');
    expect(resolveCorrelationId(undefined)).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it('truncates non-sensitive long strings during serialization', () => {
    const longText = 'x'.repeat(600);
    const parsed = JSON.parse(
      serializeStructuredLog({
        event: 'long_text',
        detail: longText,
      }),
    ) as Record<string, string>;

    expect(parsed.detail).toContain('[truncated:');
    expect(parsed.detail.length).toBeLessThan(longText.length);
  });

  it('hashes client identifiers for privacy', () => {
    const fingerprintA = fingerprintIdentifier('ip:127.0.0.1');
    const fingerprintB = fingerprintIdentifier('ip:127.0.0.1');
    const fingerprintC = fingerprintIdentifier('ip:10.0.0.1');

    expect(fingerprintA).toHaveLength(16);
    expect(fingerprintA).toBe(fingerprintB);
    expect(fingerprintA).not.toBe(fingerprintC);
  });
});
