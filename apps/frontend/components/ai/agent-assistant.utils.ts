export const parseActionPayload = (
  payloadJson?: string | null,
): Record<string, string> => {
  if (!payloadJson) return {};

  try {
    const parsed = JSON.parse(payloadJson) as Record<string, unknown>;
    return Object.entries(parsed).reduce<Record<string, string>>(
      (accumulator, [key, value]) => {
        if (typeof value === 'string') {
          accumulator[key] = value;
        }
        return accumulator;
      },
      {},
    );
  } catch {
    return {};
  }
};
