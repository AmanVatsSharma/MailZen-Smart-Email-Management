/**
 * File:        apps/backend/src/core/application/ports/gateways/pubsub.gateway.ts
 * Module:      Application · Port
 * Purpose:     Pub/Sub gateway port. Handles Gmail webhook subscriptions
 *              for real-time email sync. Hides the underlying messaging
 *              infrastructure (Pub/Sub, Redis streams).
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

export interface PubSubMessage {
  id: string;
  topic: string;
  data: Buffer;
  attributes: Record<string, string | null>;
}

export type PubSubHandler = (message: PubSubMessage) => Promise<void>;

export interface IPubSubGateway {
  subscribe(
    topic: string,
    handler: PubSubHandler,
  ): Promise<string>; // Returns subscription ID

  unsubscribe(subscriptionId: string): Promise<void>;

  publish(topic: string, data: Buffer, attributes?: Record<string, string | null>): Promise<void>;
}

export const PUBSUB_GATEWAY = Symbol('IPubSubGateway');
