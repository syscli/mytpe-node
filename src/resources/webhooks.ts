// Webhooks: subscriptions that POST events to your URL, plus the delivery log and
// secret rotation. Create returns the signing `secret` once, so store it then.
// The resource also exposes `constructEvent`, which verifies an incoming request
// and parses it, so the verification helper is reachable from the client too.

import { Resource, type Page } from "./base";
import {
  constructWebhookEvent,
  verifyWebhookSignature,
  type VerifyOptions,
  type WebhookEvent,
} from "../signature";
import type { Timestamp, Uuid } from "../types";

export interface Webhook {
  id: Uuid;
  url: string;
  description: string | null;
  events: string[];
  is_active: boolean;
  /** Present only in the create and regenerate-secret responses. */
  secret?: string;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface WebhookCreate {
  url: string;
  events: string[];
  description?: string;
  is_active?: boolean;
}

export interface WebhookUpdate {
  url?: string;
  events?: string[];
  description?: string;
  is_active?: boolean;
}

/** An available event type, as listed by `events()`. */
export interface WebhookEventInfo {
  /** The event name to subscribe to, such as `transaction.paid`. */
  value: string;
  /** A human label, such as "Transaction Paid". */
  label: string;
}

/** One attempt to deliver an event to your URL. */
export interface WebhookDelivery {
  id: Uuid;
  event?: string;
  status?: string;
  response_code?: number | null;
  created_at?: Timestamp;
  [key: string]: unknown;
}

export interface WebhookListParams {
  page?: number;
  per_page?: number;
}

export class Webhooks extends Resource {
  list(params: WebhookListParams = {}): Promise<Page<Webhook>> {
    return this.fetchPage<Webhook>("webhooks", { ...params });
  }

  paginate(params: WebhookListParams = {}): AsyncGenerator<Webhook> {
    return this.iterate(this.list(params));
  }

  /** Create a webhook. The response includes the signing secret, shown once. */
  create(input: WebhookCreate, signal?: AbortSignal): Promise<Webhook> {
    return this.post<Webhook>("webhooks", input, signal);
  }

  /** The event types you can subscribe to. */
  events(signal?: AbortSignal): Promise<WebhookEventInfo[]> {
    return this.getData<WebhookEventInfo[]>("webhooks/events", undefined, signal);
  }

  get(id: Uuid, signal?: AbortSignal): Promise<Webhook> {
    return this.getData<Webhook>(`webhooks/${encodeURIComponent(id)}`, undefined, signal);
  }

  update(id: Uuid, input: WebhookUpdate, signal?: AbortSignal): Promise<Webhook> {
    return this.patch<Webhook>(`webhooks/${encodeURIComponent(id)}`, input, signal);
  }

  delete(id: Uuid, signal?: AbortSignal): Promise<void> {
    return this.remove(`webhooks/${encodeURIComponent(id)}`, signal);
  }

  /** Rotate the signing secret. The response carries the new secret, shown once. */
  regenerateSecret(id: Uuid, signal?: AbortSignal): Promise<Webhook> {
    return this.post<Webhook>(
      `webhooks/${encodeURIComponent(id)}/regenerate-secret`,
      undefined,
      signal,
    );
  }

  /** The delivery attempts for a webhook, newest first. */
  deliveries(
    id: Uuid,
    params: WebhookListParams = {},
  ): Promise<Page<WebhookDelivery>> {
    return this.fetchPage<WebhookDelivery>(
      `webhooks/${encodeURIComponent(id)}/deliveries`,
      { ...params },
    );
  }

  /** Retry a past delivery. Returns the API's confirmation message. */
  redeliver(id: Uuid, deliveryId: Uuid, signal?: AbortSignal): Promise<string> {
    return this.action(
      `webhooks/${encodeURIComponent(id)}/deliveries/${encodeURIComponent(deliveryId)}/redeliver`,
      "POST",
      signal,
    );
  }

  /**
   * Verify an incoming webhook against its secret. Returns true when the
   * signature and timestamp check out. Pass the raw request body, untouched.
   */
  verify(
    rawBody: string,
    signatureHeader: string,
    secret: string,
    options?: VerifyOptions,
  ): boolean {
    return verifyWebhookSignature(rawBody, signatureHeader, secret, options);
  }

  /**
   * Verify and parse an incoming webhook in one step, throwing if it does not
   * check out. Use this in your handler so a returned event is trustworthy.
   */
  constructEvent(
    rawBody: string,
    signatureHeader: string,
    secret: string,
    options?: VerifyOptions,
  ): WebhookEvent {
    return constructWebhookEvent(rawBody, signatureHeader, secret, options);
  }
}
