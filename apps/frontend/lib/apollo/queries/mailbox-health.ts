import { gql } from '@apollo/client';

export const GET_MY_MAILBOX_SYNC_STATES = gql`
  query MyMailboxSyncStates($workspaceId: String) {
    myMailboxSyncStates(workspaceId: $workspaceId) {
      mailboxId
      mailboxEmail
      workspaceId
      inboundSyncStatus
      inboundSyncLastPolledAt
      inboundSyncLastError
      inboundSyncLastErrorAt
    }
  }
`;

export const GET_MY_MAILBOX_SYNC_RUN_STATS = gql`
  query MyMailboxSyncRunStats($mailboxId: String, $workspaceId: String, $windowHours: Int) {
    myMailboxSyncRunStats(mailboxId: $mailboxId, workspaceId: $workspaceId, windowHours: $windowHours) {
      mailboxId
      workspaceId
      windowHours
      totalRuns
      successRuns
      partialRuns
      failedRuns
      skippedRuns
      fetchedMessages
      acceptedMessages
      deduplicatedMessages
      rejectedMessages
      avgDurationMs
      latestCompletedAtIso
    }
  }
`;

export const GET_MY_MAILBOX_SYNC_RUN_SERIES = gql`
  query MyMailboxSyncRunSeries($mailboxId: String, $workspaceId: String, $windowHours: Int, $bucketMinutes: Int) {
    myMailboxSyncRunSeries(
      mailboxId: $mailboxId
      workspaceId: $workspaceId
      windowHours: $windowHours
      bucketMinutes: $bucketMinutes
    ) {
      bucketStart
      totalRuns
      successRuns
      partialRuns
      failedRuns
      skippedRuns
      fetchedMessages
      acceptedMessages
    }
  }
`;

export const GET_MY_MAILBOX_SYNC_INCIDENT_STATS = gql`
  query MyMailboxSyncIncidentStats($mailboxId: String, $workspaceId: String, $windowHours: Int) {
    myMailboxSyncIncidentStats(mailboxId: $mailboxId, workspaceId: $workspaceId, windowHours: $windowHours) {
      mailboxId
      workspaceId
      windowHours
      totalRuns
      incidentRuns
      failedRuns
      partialRuns
      incidentRatePercent
      lastIncidentAtIso
    }
  }
`;

export const GET_MY_MAILBOX_SYNC_INCIDENT_SERIES = gql`
  query MyMailboxSyncIncidentSeries($mailboxId: String, $workspaceId: String, $windowHours: Int, $bucketMinutes: Int) {
    myMailboxSyncIncidentSeries(
      mailboxId: $mailboxId
      workspaceId: $workspaceId
      windowHours: $windowHours
      bucketMinutes: $bucketMinutes
    ) {
      bucketStart
      totalRuns
      incidentRuns
      failedRuns
      partialRuns
    }
  }
`;

export const GET_MY_MAILBOX_SYNC_INCIDENT_ALERTS = gql`
  query MyMailboxSyncIncidentAlerts($workspaceId: String, $windowHours: Int, $limit: Int) {
    myMailboxSyncIncidentAlerts(workspaceId: $workspaceId, windowHours: $windowHours, limit: $limit) {
      notificationId
      workspaceId
      status
      title
      message
      incidentRatePercent
      incidentRuns
      totalRuns
      warningRatePercent
      criticalRatePercent
      createdAt
    }
  }
`;

export const GET_MY_MAILBOX_SYNC_INCIDENT_ALERT_CONFIG = gql`
  query MyMailboxSyncIncidentAlertConfig {
    myMailboxSyncIncidentAlertConfig {
      alertsEnabled
      windowHours
      cooldownMinutes
      warningRatePercent
      criticalRatePercent
      minIncidentRuns
      evaluatedAtIso
    }
  }
`;

export const GET_MY_MAILBOX_SYNC_INCIDENT_ALERT_DELIVERY_STATS = gql`
  query MyMailboxSyncIncidentAlertDeliveryStats($workspaceId: String, $windowHours: Int) {
    myMailboxSyncIncidentAlertDeliveryStats(workspaceId: $workspaceId, windowHours: $windowHours) {
      workspaceId
      windowHours
      totalCount
      warningCount
      criticalCount
      lastAlertAtIso
    }
  }
`;

export const RUN_MY_MAILBOX_SYNC_INCIDENT_ALERT_CHECK = gql`
  mutation RunMyMailboxSyncIncidentAlertCheck(
    $windowHours: Int
    $warningRatePercent: Float
    $criticalRatePercent: Float
    $minIncidentRuns: Int
  ) {
    runMyMailboxSyncIncidentAlertCheck(
      windowHours: $windowHours
      warningRatePercent: $warningRatePercent
      criticalRatePercent: $criticalRatePercent
      minIncidentRuns: $minIncidentRuns
    ) {
      alertsEnabled
      evaluatedAtIso
      windowHours
      status
      statusReason
      shouldAlert
      totalRuns
      incidentRuns
      incidentRatePercent
    }
  }
`;

export const SYNC_MY_MAILBOX_PULL = gql`
  mutation SyncMyMailboxPull($mailboxId: String, $workspaceId: String) {
    syncMyMailboxPull(mailboxId: $mailboxId, workspaceId: $workspaceId) {
      polledMailboxes
      fetchedMessages
      acceptedMessages
      deduplicatedMessages
      rejectedMessages
      executedAtIso
    }
  }
`;

export const PURGE_MY_MAILBOX_SYNC_RUN_RETENTION_DATA = gql`
  mutation PurgeMyMailboxSyncRunRetentionData($retentionDays: Int) {
    purgeMyMailboxSyncRunRetentionData(retentionDays: $retentionDays) {
      deletedRuns
      retentionDays
      executedAtIso
    }
  }
`;

export const GET_MY_MAILBOX_SYNC_DATA_EXPORT = gql`
  query MyMailboxSyncDataExport($mailboxId: String, $workspaceId: String, $windowHours: Int) {
    myMailboxSyncDataExport(mailboxId: $mailboxId, workspaceId: $workspaceId, windowHours: $windowHours) {
      generatedAtIso
      dataJson
    }
  }
`;

export const GET_MY_MAILBOX_SYNC_INCIDENT_DATA_EXPORT = gql`
  query MyMailboxSyncIncidentDataExport($workspaceId: String, $windowHours: Int) {
    myMailboxSyncIncidentDataExport(workspaceId: $workspaceId, windowHours: $windowHours) {
      generatedAtIso
      dataJson
    }
  }
`;

export const GET_MY_MAILBOX_INBOUND_DATA_EXPORT = gql`
  query MyMailboxInboundDataExport($mailboxId: String, $workspaceId: String, $windowHours: Int) {
    myMailboxInboundDataExport(mailboxId: $mailboxId, workspaceId: $workspaceId, windowHours: $windowHours) {
      generatedAtIso
      dataJson
    }
  }
`;
