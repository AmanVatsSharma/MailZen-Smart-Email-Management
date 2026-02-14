import { ApolloClient, InMemoryCache, HttpLink, from, ApolloLink } from '@apollo/client';
import { onError } from '@apollo/client/link/error';

// Error handling link
const errorLink = onError(({ graphQLErrors, networkError }) => {
  if (graphQLErrors)
    graphQLErrors.forEach(({ message, locations, path }) => {
      console.error(`[GraphQL error]: Message: ${message}, Location: ${locations}, Path: ${path}`);
    });
  if (networkError) console.error(`[Network error]: ${networkError}`);
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
    console.warn('[Apollo] request', {
      operationName: operation.operationName,
      variables: operation.variables,
    });
  }
  return forward(operation);
});

// Initialize Apollo Client
export const client = new ApolloClient({
  // Auth is cookie-based (HttpOnly) so we do NOT read tokens from localStorage.
  // Cookies are sent automatically via `credentials: 'include'` on httpLink.
  link: from([errorLink, debugLink, refreshLink, httpLink]),
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'cache-and-network',
    },
  },
});
