/**
 * File:        apps/backend/src/core/application/use-cases/notifications/list-notifications/list-notifications.command.ts
 * Module:      Notifications Use Cases
 * Purpose:     Command for ListNotifications use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { ListNotificationsDto } from './list-notifications.dto';

export class ListNotificationsCommand {
  constructor(public readonly input: ListNotificationsDto) {}
}
