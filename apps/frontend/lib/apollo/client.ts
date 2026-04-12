import { ApolloClient, InMemoryCache, HttpLink, from, ApolloLink, Observable } from '@apollo/client';
import { onError } from '@apollo/client/link/error';
import { setContext } from '@apollo/client/link/context';
import { getRefreshToken, removeRefreshToken, removeUserData, setRefreshToken } from '@/modules/auth';

// Auth model: the backend sets an HttpOnly `token` cookie on login/refresh.
// All GraphQL requests include the cookie automatically via `credentials: 'include'`.
// The refresh token is stored in localStorage solely because the backend's
// `refresh` mutation requires it as a body parameter. When the backend supports
// cookie-based refresh, localStorage usage can be eliminated entirely.

const GRAPHQL_ENDPOINT =
  process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT || 'http://localhost:4000/graphql';

const createRequestId = (operationName?: string): string => {
  const base = operationName && operationName.length > 0 ? operationName : 'graphql-op';
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.randomUUID) {
    return `${base}-${globalThis.crypto.randomUUID()}`;
  }
  return `${base}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

// Performs a token refresh using a plain fetch to avoid circular Apollo dependency.
// Returns the new refresh token on success, or null on failure.
async function fetchNewTokens(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  try {
    const res = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation Refresh($refreshToken: String!) {
            refresh(input: { refreshToken: $refreshToken }) {
              token
              refreshToken
            }
          }
        `,
        variables: { refreshToken },
      }),
    });

    const json = await res.json();
    const newRefreshToken = json?.data?.refresh?.refreshToken;
    if (newRefreshToken) {
      setRefreshToken(newRefreshToken);
      return newRefreshToken;
    }
  } catch {
    // Network error during refresh — fall through to sign-out
  }

  // Refresh failed — clear stored credentials so the user is redirected to login
  removeRefreshToken();
  removeUserData();
  return null;
}

// Tracks an in-flight refresh to avoid parallel refresh calls for concurrent failing requests.
let pendingRefresh: Promise<string | null> | null = null;

// Error handling link — intercepts UNAUTHENTICATED errors and attempts a token refresh.
const errorLink = onError(({ graphQLErrors, networkError, operation, forward }) => {
  const isUnauthenticated = graphQLErrors?.some(
    (e) => e.extensions?.code === 'UNAUTHENTICATED' || e.message === 'Unauthorized',
  );

  if (isUnauthenticated) {
    return new Observable((observer) => {
      const attemptRefresh = async () => {
        try {
          if (!pendingRefresh) {
            pendingRefresh = fetchNewTokens().finally(() => {
              pendingRefresh = null;
            });
          }
          const newToken = await pendingRefresh;

          if (!newToken) {
            // Refresh failed — redirect to login
            if (typeof window !== 'undefined') {
              window.location.href = '/auth/login';
            }
            observer.error(new Error('Session expired. Please sign in again.'));
            return;
          }

          // Retry the failed operation now that we have a fresh cookie
          const sub = forward(operation).subscribe({
            next: observer.next.bind(observer),
            error: observer.error.bind(observer),
            complete: observer.complete.bind(observer),
          });
          return () => sub.unsubscribe();
        } catch (err) {
          observer.error(err);
        }
      };

      attemptRefresh();
    });
  }

  if (graphQLErrors) {
    graphQLErrors.forEach(({ message, locations, path }) => {
      console.error(`[GraphQL error]: Message: ${message}, Location: ${locations}, Path: ${path}`);
    });
  }
  if (networkError) console.error(`[Network error]: ${networkError}`);
});

const requestContextLink = setContext((operation, previousContext) => {
  const requestId = createRequestId(operation.operationName);
  const headers = previousContext.headers ?? {};
  return {
    headers: {
      ...headers,
      'x-request-id': requestId,
    },
  };
});

// HTTP link to the GraphQL server
const httpLink = new HttpLink({
  uri: GRAPHQL_ENDPOINT,
  credentials: 'include',
});

// Dev-only request logging for debugging and later observability work.
const debugLink = new ApolloLink((operation, forward) => {
  if (process.env.NODE_ENV !== 'production') {
    const requestId = operation.getContext()?.headers?.['x-request-id'];
    console.warn('[Apollo] request', {
      operationName: operation.operationName,
      requestId,
      variables: operation.variables,
    });
  }
  return forward(operation);
});

// Initialize Apollo Client
export const client = new ApolloClient({
  link: from([errorLink, requestContextLink, debugLink, httpLink]),
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'cache-and-network',
    },
  },
});
