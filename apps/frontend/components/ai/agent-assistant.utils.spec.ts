import { parseActionPayload } from './agent-assistant.utils';

describe('parseActionPayload', () => {
  it('returns parsed string values', () => {
    expect(parseActionPayload('{"email":"user@example.com","x":"1"}')).toEqual({
      email: 'user@example.com',
      x: '1',
    });
  });

  it('returns empty object for invalid JSON', () => {
    expect(parseActionPayload('{invalid}')).toEqual({});
  });

  it('returns empty object when payload is missing', () => {
    expect(parseActionPayload(undefined)).toEqual({});
  });
});
