import { gql } from '@apollo/client';

export const GET_MY_AGENT_ACTION_AUDITS = gql`
  query MyAgentActionAudits($limit: Float) {
    myAgentActionAudits(limit: $limit) {
      id
      requestId
      skill
      action
      executed
      approvalRequired
      message
      metadata
      createdAt
      updatedAt
    }
  }
`;

export const GET_MY_AGENT_ACTION_DATA_EXPORT = gql`
  query MyAgentActionDataExport($limit: Int) {
    myAgentActionDataExport(limit: $limit) {
      generatedAtIso
      dataJson
    }
  }
`;
