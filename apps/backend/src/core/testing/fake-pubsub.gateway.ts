/**
 * File:        apps/backend/src/core/testing/fake-pubsub.gateway.ts
 * Module:      Testing · Fake
 * Purpose:     Fake IPubSubGateway for unit tests. Records subscriptions
 *              and published messages; does not connect to real Pub/Sub.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { IPubSubGateway, PubSubHandler, PubSubMessage } from 'application/ports/gateways/pubsub.gateway';

export class FakePubSubGateway implements IPubSubGateway {
  subscriptions: Map<string, { topic: string; handler: PubSubHandler }> = new Map();
  publishedMessages: { topic: string; data: Buffer; attributes?: Record<string, string | null> }[] = [];
  private nextSubscriptionId = 0;

  async subscribe(topic: string, handler: PubSubHandler): Promise<string> {
    const id = `sub-${++this.nextSubscriptionId}`;
    this.subscriptions.set(id, { topic, handler });
    return id;
  }

  async unsubscribe(subscriptionId: string): Promise<void> {
    this.subscriptions.delete(subscriptionId);
  }

  async publish(
    topic: string,
    data: Buffer,
    attributes?: Record<string, string | null>,
  ): Promise<void> {
    this.publishedMessages.push({ topic, data, attributes });
  }

  async simulateMessage(subscriptionId: string, message: PubSubMessage): Promise<void> {
    const sub = this.subscriptions.get(subscriptionId);
    if (sub) {
      await sub.handler(message);
    }
  }

  reset(): void {
    this.subscriptions.clear();
    this.publishedMessages = [];
    this.nextSubscriptionId = 0;
  }
}
