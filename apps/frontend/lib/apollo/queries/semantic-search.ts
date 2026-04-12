import { gql } from '@apollo/client';

export const SEMANTIC_SEARCH_QUERY = gql`
  query SemanticSearch($query: String!, $limit: Int) {
    semanticSearch(query: $query, limit: $limit) {
      emailIds
      query
    }
  }
`;
