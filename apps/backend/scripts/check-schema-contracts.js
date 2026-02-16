const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, '..', 'src', 'schema.gql');

const requiredContracts = [
  'myAccountDataExport',
  'billingPlans',
  'mySubscription',
  'myAiCreditBalance',
  'myEntitlementUsage',
  'myBillingInvoices',
  'myBillingDataExport',
  'selectMyPlan',
  'startMyPlanTrial',
  'purgeBillingRetentionData',
  'requestMyPlanUpgrade',
  'ingestBillingWebhook',
  'purgeAgentActionRetentionData',
  'myNotifications',
  'myMailboxInboundSlaIncidentStats',
  'myMailboxInboundSlaIncidentSeries',
  'myMailboxInboundSlaIncidentDataExport',
  'myMailboxInboundSlaIncidentAlertConfig',
  'myNotificationDataExport',
  'myMailboxInboundDataExport',
  'myMailboxProvisioningHealth',
  'myMailboxSyncStates',
  'myMailboxSyncRuns',
  'myMailboxSyncRunStats',
  'myMailboxSyncRunSeries',
  'myMailboxSyncIncidentStats',
  'myMailboxSyncIncidentSeries',
  'myMailboxSyncIncidentDataExport',
  'myMailboxSyncIncidentAlertConfig',
  'myMailboxSyncIncidentAlertDeliveryStats',
  'myMailboxSyncIncidentAlerts',
  'myMailboxSyncIncidentAlertHistoryDataExport',
  'myMailboxSyncIncidentAlertDeliverySeries',
  'myMailboxSyncIncidentAlertDeliveryDataExport',
  'runMyMailboxSyncIncidentAlertCheck',
  'myMailboxSyncDataExport',
  'purgeMyMailboxSyncRunRetentionData',
  'myNotificationPreferences',
  'markMyNotificationsRead',
  'updateMyNotificationPreferences',
  'purgeNotificationRetentionData',
  'purgeMyMailboxInboundRetentionData',
  'syncMyMailboxPull',
  'syncMyProviders',
  'syncMyInboxes',
  'myInboxSourceHealthStats',
  'myProviderSyncStats',
  'myProviderSyncDataExport',
  'smartReplySettings',
  'mySmartReplyHistory',
  'mySmartReplyDataExport',
  'mySmartReplyProviderHealth',
  'updateSmartReplySettings',
  'purgeMySmartReplyHistory',
  'myWorkspaces',
  'myActiveWorkspace',
  'myWorkspaceDataExport',
  'workspaceMembers',
  'myPendingWorkspaceInvitations',
  'createWorkspace',
  'setActiveWorkspace',
  'inviteWorkspaceMember',
  'updateWorkspaceMemberRole',
  'removeWorkspaceMember',
  'respondWorkspaceInvitation',
  'myMailboxInboundEvents',
  'myMailboxInboundEventStats',
  'myMailboxInboundEventSeries',
  'myNotificationPushSubscriptions',
  'registerMyNotificationPushSubscription',
  'unregisterMyNotificationPushSubscription',
  'isFeatureEnabled',
  'agentAssist',
  'agentPlatformHealth',
  'agentPlatformHealthHistory',
  'agentPlatformHealthSampleDataExport',
  'agentPlatformHealthTrendSummary',
  'agentPlatformHealthTrendSeries',
  'agentPlatformHealthIncidentStats',
  'agentPlatformHealthIncidentSeries',
  'agentPlatformHealthIncidentDataExport',
  'agentPlatformHealthAlertDeliveryStats',
  'agentPlatformHealthAlertDeliverySeries',
  'agentPlatformHealthAlertDeliveryDataExport',
  'agentPlatformHealthAlertConfig',
  'agentPlatformHealthAlertRunHistory',
  'agentPlatformHealthAlertRunHistoryDataExport',
  'agentPlatformHealthAlertRunTrendSummary',
  'agentPlatformHealthAlertRunTrendSeries',
  'agentPlatformHealthAlertRunTrendDataExport',
  'runAgentPlatformHealthAlertCheck',
  'purgeAgentPlatformHealthAlertRunRetentionData',
  'resetAgentPlatformRuntimeStats',
  'resetAgentPlatformSkillRuntimeStats',
  'purgeAgentPlatformHealthSampleRetentionData',
  'myAgentActionAudits',
  'myAgentActionDataExport',
];

const run = () => {
  if (!fs.existsSync(schemaPath)) {
    console.error(`Schema file not found at ${schemaPath}`);
    process.exit(1);
  }

  const schemaContents = fs.readFileSync(schemaPath, 'utf8');
  const missingContracts = requiredContracts.filter(
    (contract) => !schemaContents.includes(contract),
  );

  if (!missingContracts.length) {
    console.log(
      `Schema contract check passed (${requiredContracts.length} contracts).`,
    );
    return;
  }

  console.error(
    `Schema contract check failed. Missing contracts: ${missingContracts.join(', ')}`,
  );
  process.exit(1);
};

run();
