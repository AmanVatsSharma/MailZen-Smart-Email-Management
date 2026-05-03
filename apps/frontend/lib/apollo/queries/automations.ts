/**
 * File:        apps/frontend/lib/apollo/queries/automations.ts
 * Module:      Frontend · Apollo Client · Automation Engine queries
 * Purpose:     GraphQL query and mutation documents for the Automation Engine.
 *              Matches the backend AutomationResolver contract exactly.
 *
 * Exports:
 *   Query documents:
 *   - GET_AUTOMATIONS          — paginated workspace automation list
 *   - GET_AUTOMATION           — single automation with versions + recent runs
 *   - GET_AUTOMATION_RUNS      — paginated run list (filterable by automationId/status)
 *   - GET_AUTOMATION_RUN       — single run with step audit trail
 *
 *   Mutation documents:
 *   - CREATE_AUTOMATION
 *   - UPDATE_AUTOMATION
 *   - ENABLE_AUTOMATION
 *   - DISABLE_AUTOMATION
 *   - ARCHIVE_AUTOMATION
 *   - RUN_AUTOMATION_MANUALLY
 *   - RETRY_AUTOMATION_RUN
 *   - CANCEL_AUTOMATION_RUN
 *
 * Side-effects:
 *   - none — gql tag documents only
 *
 * Author:      AmanVatsSharma
 * Last-updated: 2026-05-03
 */

import { gql } from '@apollo/client';

// ─── Fragments ────────────────────────────────────────────────────────────

const AUTOMATION_FIELDS = gql`
  fragment AutomationFields on Automation {
    id
    workspaceId
    ownerUserId
    name
    description
    status
    currentVersionId
    createdByUserId
    createdAt
    updatedAt
  }
`;

const AUTOMATION_VERSION_FIELDS = gql`
  fragment AutomationVersionFields on AutomationVersion {
    id
    automationId
    version
    trigger
    conditions
    steps
    publishedAt
    publishedByUserId
  }
`;

const AUTOMATION_RUN_FIELDS = gql`
  fragment AutomationRunFields on AutomationRun {
    id
    automationId
    automationVersionId
    status
    triggerEvent
    correlationId
    startedAt
    finishedAt
    errorCode
    errorMessage
    createdAt
  }
`;

const AUTOMATION_STEP_RUN_FIELDS = gql`
  fragment AutomationStepRunFields on AutomationStepRun {
    id
    stepIndex
    stepType
    status
    input
    output
    attempt
    errorCode
    errorMessage
    startedAt
    finishedAt
  }
`;

// ─── Queries ──────────────────────────────────────────────────────────────

export const GET_AUTOMATIONS = gql`
  ${AUTOMATION_FIELDS}
  query GetAutomations(
    $workspaceId: ID!
    $status: AutomationStatus
    $ownerUserId: ID
    $limit: Int
    $cursor: String
  ) {
    automations(
      workspaceId: $workspaceId
      status: $status
      ownerUserId: $ownerUserId
      limit: $limit
      cursor: $cursor
    ) {
      nodes {
        ...AutomationFields
      }
      nextCursor
    }
  }
`;

export const GET_AUTOMATION = gql`
  ${AUTOMATION_FIELDS}
  ${AUTOMATION_VERSION_FIELDS}
  ${AUTOMATION_RUN_FIELDS}
  query GetAutomation($id: ID!, $workspaceId: ID!) {
    automation(id: $id, workspaceId: $workspaceId) {
      ...AutomationFields
      versions(limit: 10) {
        ...AutomationVersionFields
      }
      recentRuns(limit: 20) {
        ...AutomationRunFields
      }
    }
  }
`;

export const GET_AUTOMATION_RUNS = gql`
  ${AUTOMATION_RUN_FIELDS}
  query GetAutomationRuns(
    $workspaceId: ID
    $automationId: ID
    $status: AutomationRunStatus
    $limit: Int
    $cursor: String
  ) {
    automationRuns(
      workspaceId: $workspaceId
      automationId: $automationId
      status: $status
      limit: $limit
      cursor: $cursor
    ) {
      nodes {
        ...AutomationRunFields
      }
      nextCursor
    }
  }
`;

export const GET_AUTOMATION_RUN = gql`
  ${AUTOMATION_RUN_FIELDS}
  ${AUTOMATION_STEP_RUN_FIELDS}
  query GetAutomationRun($id: ID!) {
    automationRun(id: $id) {
      ...AutomationRunFields
      steps {
        ...AutomationStepRunFields
      }
    }
  }
`;

// ─── Mutations ────────────────────────────────────────────────────────────

export const CREATE_AUTOMATION = gql`
  ${AUTOMATION_FIELDS}
  mutation CreateAutomation(
    $workspaceId: ID!
    $name: String!
    $trigger: JSON!
    $steps: JSON!
    $description: String
    $ownerUserId: ID
    $conditions: JSON
  ) {
    createAutomation(
      workspaceId: $workspaceId
      name: $name
      trigger: $trigger
      steps: $steps
      description: $description
      ownerUserId: $ownerUserId
      conditions: $conditions
    ) {
      ...AutomationFields
    }
  }
`;

export const UPDATE_AUTOMATION = gql`
  ${AUTOMATION_FIELDS}
  mutation UpdateAutomation(
    $id: ID!
    $workspaceId: ID!
    $name: String
    $description: String
    $trigger: JSON
    $conditions: JSON
    $steps: JSON
  ) {
    updateAutomation(
      id: $id
      workspaceId: $workspaceId
      name: $name
      description: $description
      trigger: $trigger
      conditions: $conditions
      steps: $steps
    ) {
      ...AutomationFields
    }
  }
`;

export const ENABLE_AUTOMATION = gql`
  ${AUTOMATION_FIELDS}
  mutation EnableAutomation($id: ID!, $workspaceId: ID!) {
    enableAutomation(id: $id, workspaceId: $workspaceId) {
      ...AutomationFields
    }
  }
`;

export const DISABLE_AUTOMATION = gql`
  ${AUTOMATION_FIELDS}
  mutation DisableAutomation($id: ID!, $workspaceId: ID!) {
    disableAutomation(id: $id, workspaceId: $workspaceId) {
      ...AutomationFields
    }
  }
`;

export const ARCHIVE_AUTOMATION = gql`
  ${AUTOMATION_FIELDS}
  mutation ArchiveAutomation($id: ID!, $workspaceId: ID!) {
    archiveAutomation(id: $id, workspaceId: $workspaceId) {
      ...AutomationFields
    }
  }
`;

export const RUN_AUTOMATION_MANUALLY = gql`
  ${AUTOMATION_RUN_FIELDS}
  mutation RunAutomationManually($id: ID!, $workspaceId: ID!, $contextOverride: JSON) {
    runAutomationManually(id: $id, workspaceId: $workspaceId, contextOverride: $contextOverride) {
      ...AutomationRunFields
    }
  }
`;

export const RETRY_AUTOMATION_RUN = gql`
  ${AUTOMATION_RUN_FIELDS}
  mutation RetryAutomationRun($runId: ID!) {
    retryAutomationRun(runId: $runId) {
      ...AutomationRunFields
    }
  }
`;

export const CANCEL_AUTOMATION_RUN = gql`
  ${AUTOMATION_RUN_FIELDS}
  mutation CancelAutomationRun($runId: ID!) {
    cancelAutomationRun(runId: $runId) {
      ...AutomationRunFields
    }
  }
`;
