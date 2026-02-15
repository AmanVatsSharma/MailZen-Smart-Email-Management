# Billing Module (Backend)

## Goal

Provide a persistent SaaS foundation for plan catalog and user subscription
state, enabling entitlement-aware product rollouts.

## Responsibilities

- Maintain active billing plan catalog (`billing_plans`)
- Maintain user subscription state (`user_subscriptions`)
- Track monthly AI credit usage (`user_ai_credit_usages`)
- Seed default plans when catalog is empty
- Expose GraphQL operations for:
  - listing plans
  - reading current subscription
  - reading current AI credit balance
  - selecting active plan
  - recording upgrade intent (`requestMyPlanUpgrade`)

## GraphQL API

- `billingPlans`: list active plans
- `mySubscription`: get current user subscription (auto-provisions FREE plan)
- `myAiCreditBalance`: get current month AI credit usage + remaining credits
- `selectMyPlan(planCode)`: switch current user subscription to active plan
- `requestMyPlanUpgrade(targetPlanCode, note?)`: records upgrade intent notification

## Flow

```mermaid
flowchart TD
  User --> Resolver[BillingResolver]
  Resolver --> Service[BillingService]
  Service --> PlanRepo[(billing_plans)]
  Service --> SubRepo[(user_subscriptions)]
  Service --> AiUsageRepo[(user_ai_credit_usages)]
  PlanRepo --> Service
  SubRepo --> Service
  AiUsageRepo --> Service
  Service --> Resolver
  Resolver --> User
```

## Notes

- This module is intentionally payment-provider agnostic in its first iteration.
- Stripe/webhook/invoice synchronization can be layered on top of this data model.
- Current integrations:
  - `EmailProviderService` enforces `providerLimit`
  - `MailboxService` enforces `mailboxLimit`
  - `WorkspaceService` enforces `workspaceLimit`
  - `AiAgentGatewayService` consumes monthly AI credits via billing service
  - `NotificationEventBusService` stores `BILLING_UPGRADE_INTENT` intents

