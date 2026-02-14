const getBackendBaseUrl = (): string => {
  const gqlEndpoint =
    process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT || 'http://localhost:4000/graphql';

  try {
    const parsed = new URL(gqlEndpoint);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return 'http://localhost:4000';
  }
};

export const getGoogleOAuthStartUrl = (): string => {
  const url = new URL('/auth/google/start', getBackendBaseUrl());
  return url.toString();
};
