import { gql } from '@apollo/client';

export const GET_MY_PROFILE = gql`
  query MyProfile {
    myProfile {
      id
      autoSendTier
    }
  }
`;

export const UPDATE_AUTO_SEND_TIER = gql`
  mutation UpdateAutoSendTier($tier: String!) {
    updateAutoSendTier(tier: $tier) {
      id
      autoSendTier
    }
  }
`;

export const GET_THREAD_INSIGHTS = gql`
  query ThreadInsights($threadId: String!) {
    threadInsights(threadId: $threadId) {
      threadId
      summary
      classification {
        label
        confidence
        message
      }
      priority {
        level
        score
        message
      }
      actionItems
      generatedAt
    }
  }
`;

export const GET_AGENT_PLATFORM_HEALTH = gql`
  query AgentPlatformHealth {
    agentPlatformHealth {
      status
      reachable
      alertingState
      errorRatePercent
      latencyMs
    }
  }
`;

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
        requiresApproval
        approvalToken
        approvalTokenExpiresAtIso
      }
      safetyFlags {
        code
        severity
        message
      }
      uiHintsJson
      aiCreditsMonthlyLimit
      aiCreditsUsed
      aiCreditsRemaining
      platformEndpointUsed
      platformAttemptCount
      executedAction {
        action
        executed
        message
      }
    }
  }
`;
