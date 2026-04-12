export type NotificationForContext = {
  id: string;
  workspaceId?: string | null;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  metadata?: Record<string, unknown> | string | null;
  createdAt: string;
};

export type WorkspaceForContext = {
  id: string;
  name: string;
};

export function resolveNotificationMetadata(
  notification: NotificationForContext,
): Record<string, unknown> {
  const rawMetadata = notification.metadata;
  if (!rawMetadata) return {};
  if (typeof rawMetadata === 'string') {
    try {
      const parsed = JSON.parse(rawMetadata) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed))
        return parsed as Record<string, unknown>;
    } catch {
      return {};
    }
    return {};
  }
  if (typeof rawMetadata === 'object' && !Array.isArray(rawMetadata)) return rawMetadata;
  return {};
}

export function formatNotificationContext(
  notification: NotificationForContext,
  workspaces: WorkspaceForContext[],
): string | null {
  const metadata = resolveNotificationMetadata(notification);
  const workspaceId =
    typeof metadata.workspaceId === 'string'
      ? metadata.workspaceId
      : notification.workspaceId || null;
  const providerType = typeof metadata.providerType === 'string' ? metadata.providerType : null;
  const mailboxEmail = typeof metadata.mailboxEmail === 'string' ? metadata.mailboxEmail : null;
  const sourceIp =
    typeof metadata.sourceIp === 'string' &&
    metadata.sourceIp !== '::1' &&
    metadata.sourceIp !== '127.0.0.1'
      ? metadata.sourceIp
      : null;
  const slaStatus = typeof metadata.slaStatus === 'string' ? metadata.slaStatus : null;
  const successRatePercent =
    typeof metadata.successRatePercent === 'number' ? metadata.successRatePercent : null;
  const rejectionRatePercent =
    typeof metadata.rejectionRatePercent === 'number' ? metadata.rejectionRatePercent : null;
  const workspaceName =
    workspaceId &&
    (workspaces.find((w) => w.id === workspaceId)?.name || workspaceId.slice(0, 8));
  const contextParts = [
    providerType ? `Provider: ${providerType}` : null,
    mailboxEmail ? `Mailbox: ${mailboxEmail}` : null,
    workspaceName ? `Workspace: ${workspaceName}` : null,
    sourceIp ? `Source IP: ${sourceIp}` : null,
    slaStatus ? `SLA: ${slaStatus}` : null,
    successRatePercent !== null ? `Success: ${successRatePercent}%` : null,
    rejectionRatePercent !== null ? `Reject: ${rejectionRatePercent}%` : null,
  ].filter(Boolean);
  if (!contextParts.length) return null;
  return contextParts.join(' · ');
}

export function getNotificationTypeBadgeColor(type: string): string {
  switch (type) {
    case 'HIGH_PRIORITY_EMAIL':
      return 'bg-red-500/10 text-red-600 border-red-500/20';
    case 'SYNC_FAILURE':
      return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
    case 'MAILBOX_INBOUND_SLA':
    case 'MAILBOX_INBOUND_SLA_WARNING':
    case 'MAILBOX_INBOUND_SLA_CRITICAL':
      return 'bg-orange-500/10 text-orange-600 border-orange-500/20';
    default:
      return 'bg-muted text-muted-foreground border-border/40';
  }
}

export function formatNotificationTypeLabel(type: string): string {
  switch (type) {
    case 'HIGH_PRIORITY_EMAIL':
      return 'High Priority';
    case 'SYNC_FAILURE':
      return 'Sync Failure';
    case 'MAILBOX_INBOUND_SLA':
    case 'MAILBOX_INBOUND_SLA_WARNING':
      return 'SLA Warning';
    case 'MAILBOX_INBOUND_SLA_CRITICAL':
      return 'SLA Critical';
    default:
      return type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  }
}
