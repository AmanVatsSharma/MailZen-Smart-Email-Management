/**
 * File:        apps/backend/src/automation/dto/slack-channel.type.ts
 * Module:      Automation Engine · DTO
 * Purpose:     GraphQL ObjectType for a Slack channel — returned by the
 *              slackChannels query so the frontend can populate a channel picker.
 *
 * Exports:
 *   - SlackChannel  — ObjectType { id, name, isPrivate }
 *
 * Key invariants:
 *   - Populated from Slack conversations.list API; not stored in DB
 *
 * Author:      AmanVatsSharma
 * Last-updated: 2026-05-06
 */

import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class SlackChannel {
  @Field()
  id: string;

  @Field()
  name: string;

  @Field()
  isPrivate: boolean;
}
