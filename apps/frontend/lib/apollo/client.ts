import { ApolloClient, InMemoryCache, HttpLink, from, ApolloLink } from '@apollo/client';
import { onError } from '@apollo/client/link/error';
import { setContext } from '@apollo/client/link/context';

const createRequestId = (operationName?: string): string => {
  const base = operationName && operationName.length > 0 ? operationName : 'graphql-op';
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.randomUUID) {
    return `${base}-${globalThis.crypto.randomUUID()}`;
  }
  return `${base}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

// Error handling link
const errorLink = onError(({ graphQLErrors, networkError }) => {
  if (graphQLErrors)
    graphQLErrors.forEach(({ message, locations, path }) => {
      console.error(`[GraphQL error]: Message: ${message}, Location: ${locations}, Path: ${path}`);
    });
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
  uri: process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT || 'http://localhost:4000/graphql',
  credentials: 'include',
});

// Optional: auto-refresh token on auth errors (local-only naive approach)
const refreshLink = new ApolloLink((operation, forward) => {
  return forward(operation).map((response) => {
    // Could inspect errors and call refresh mutation here
    return response;
  });
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
  // Auth is cookie-based (HttpOnly) so we do NOT read tokens from localStorage.
  // Cookies are sent automatically via `credentials: 'include'` on httpLink.
  link: from([errorLink, requestContextLink, debugLink, refreshLink, httpLink]),
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'cache-and-network',
    },
  },
});
