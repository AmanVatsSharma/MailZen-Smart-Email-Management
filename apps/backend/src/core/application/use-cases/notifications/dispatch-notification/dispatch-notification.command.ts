/**
 * File:        apps/backend/src/core/application/use-cases/notifications/dispatch-notification/dispatch-notification.command.ts
 * Module:      Notifications Use Cases
 * Purpose:     Command for DispatchNotification use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { DispatchNotificationDto } from './dispatch-notification.dto';

export class DispatchNotificationCommand {
  constructor(public readonly input: DispatchNotificationDto) {}
}
