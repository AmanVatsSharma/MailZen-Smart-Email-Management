import { gql } from '@apollo/client';

export const GET_BILLING_SNAPSHOT = gql`
  query BillingSnapshot {
    mySubscription {
      planCode
      status
      startedAt
    }
    billingPlans {
      code
      name
      priceMonthlyCents
      currency
      providerLimit
      mailboxLimit
      workspaceLimit
      aiCreditsPerMonth
      isActive
    }
    myWorkspaces {
      id
    }
  }
`;

export const SELECT_MY_PLAN = gql`
  mutation SelectMyPlan($planCode: String!) {
    selectMyPlan(planCode: $planCode) {
      id
      planCode
      status
      startedAt
      updatedAt
    }
  }
`;

export const REQUEST_PLAN_UPGRADE = gql`
  mutation RequestMyPlanUpgrade($targetPlanCode: String!, $note: String) {
    requestMyPlanUpgrade(targetPlanCode: $targetPlanCode, note: $note) {
      success
      targetPlanCode
      message
    }
  }
`;

