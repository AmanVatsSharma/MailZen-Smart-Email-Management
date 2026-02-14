import { gql } from '@apollo/client';

export const AGENT_ASSIST_MUTATION = gql`
  mutation AgentAssist($input: AgentAssistInput!) {
    agentAssist(input: $input) {
      version
      skill
      requestId
      assistantText
      intent
      confidence
      suggestedActions {
        name
        label
        payloadJson
      }
      safetyFlags {
        code
        severity
        message
      }
      uiHintsJson
      executedAction {
        action
        executed
        message
      }
    }
  }
`;
