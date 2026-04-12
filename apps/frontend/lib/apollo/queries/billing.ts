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

export const CREATE_STRIPE_CHECKOUT_SESSION = gql`
  mutation CreateStripeCheckoutSession(
    $planCode: String!
    $successUrl: String!
    $cancelUrl: String!
  ) {
    createStripeCheckoutSession(
      planCode: $planCode
      successUrl: $successUrl
      cancelUrl: $cancelUrl
    ) {
      sessionUrl
      sessionId
      planCode
    }
  }
`;

export const CREATE_RAZORPAY_CHECKOUT_SESSION = gql`
  mutation CreateRazorpayCheckoutSession(
    $planCode: String!
    $successUrl: String!
    $cancelUrl: String!
  ) {
    createRazorpayCheckoutSession(
      planCode: $planCode
      successUrl: $successUrl
      cancelUrl: $cancelUrl
    ) {
      checkoutUrl
      subscriptionId
      planCode
      keyId
    }
  }
`;

export const GET_ENTITLEMENT_USAGE = gql`
  query MyEntitlementUsage {
    myEntitlementUsage {
      planCode
      providerLimit
      providerUsed
      providerRemaining
      mailboxLimit
      mailboxUsed
      mailboxRemaining
      aiCreditsPerMonth
      aiCreditsUsed
      aiCreditsRemaining
      periodStart
    }
  }
`;

export const GET_MY_AI_CREDIT_BALANCE = gql`
  query MyAiCreditBalance {
    myAiCreditBalance {
      planCode
      monthlyLimit
      usedCredits
      remainingCredits
      periodStart
      lastConsumedAtIso
    }
  }
`;

export const GET_MY_BILLING_INVOICES = gql`
  query MyBillingInvoices($limit: Float) {
    myBillingInvoices(limit: $limit) {
      id
      planCode
      invoiceNumber
      provider
      status
      amountCents
      currency
      periodStart
      periodEnd
      paidAt
      createdAt
    }
  }
`;

export const GET_MY_BILLING_DATA_EXPORT = gql`
  query MyBillingDataExport {
    myBillingDataExport {
      generatedAtIso
      dataJson
    }
  }
`;

export const START_MY_PLAN_TRIAL = gql`
  mutation StartMyPlanTrial($planCode: String!, $trialDays: Float) {
    startMyPlanTrial(planCode: $planCode, trialDays: $trialDays) {
      id
      planCode
      status
      startedAt
      trialEndsAt
      isTrial
    }
  }
`;

