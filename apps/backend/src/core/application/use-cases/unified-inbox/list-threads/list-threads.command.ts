/**
 * File:        apps/backend/src/core/application/use-cases/unified-inbox/list-threads/list-threads.command.ts
 * Module:      Unified Inbox Use Cases
 * Purpose:     Command for ListThreads use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { ListThreadsDto } from './list-threads.dto';

export class ListThreadsCommand {
  constructor(public readonly input: ListThreadsDto) {}
}
