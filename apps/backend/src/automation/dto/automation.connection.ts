/**
 * File:        apps/backend/src/automation/dto/automation.connection.ts
 * Module:      Automation Engine · GraphQL DTOs
 * Purpose:     Cursor-paginated connection types for Automation and AutomationRun queries.
 *              Cursors are base64-encoded ISO-8601 timestamps of the last row's createdAt.
 *
 * Exports:
 *   - AutomationConnection      — paginated list of Automation nodes
 *   - AutomationRunConnection   — paginated list of AutomationRun nodes
 *
 * Side-effects:
 *   - Registers GraphQL ObjectTypes; included in auto-generated schema.gql
 *
 * Key invariants:
 *   - nextCursor is null when there are no more pages
 *   - Cursor decodes to a UTC ISO timestamp used in WHERE createdAt < :cursor
 *
 * Author:      AmanVatsSharma
 * Last-updated: 2026-05-03
 */

import { Field, ObjectType } from '@nestjs/graphql';
import { Automation } from '../entities/automation.entity';
import { AutomationRun } from '../entities/automation-run.entity';

@ObjectType()
export class AutomationConnection {
  @Field(() => [Automation])
  nodes: Automation[];

  @Field(() => String, { nullable: true })
  nextCursor?: string | null;
}

@ObjectType()
export class AutomationRunConnection {
  @Field(() => [AutomationRun])
  nodes: AutomationRun[];

  @Field(() => String, { nullable: true })
  nextCursor?: string | null;
}
