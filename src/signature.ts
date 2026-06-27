// Webhook signature verification. MyTPE signs each delivery with a header of the
// form `t=<unix>,v1=<hex>`, where v1 is HMAC_SHA256("{t}.{rawBody}", secret).
// You verify by recomputing the HMAC over the exact raw request body and
// comparing in constant time, then rejecting anything whose timestamp is too old
// to fence off replays. This runs server-side, so it uses node's crypto.

import { createHmac, timingSafeEqual } from "node:crypto";
import { MytpeError } from "./errors";

/** The shape of a verified webhook event body. */
export interface WebhookEventData {
  id: string;
  status?: string;
  amount?: string;
  currency?: string;
  payable_type?: string;
  payable_id?: string;
  metadata?: Record<string, unknown> | null;
  [key: string]: unknown;
}

export interface WebhookEvent {
  /** The event name, such as `transaction.paid`. */
  event: string;
  created_at: string;
  data: WebhookEventData;
}

export interface VerifyOptions {
  /** How far the timestamp may drift before it is rejected. Defaults to 300s. */
  toleranceSeconds?: number;
  /** Current time in milliseconds. Injectable for tests. */
  now?: number;
}

/** Raised when a webhook signature is missing, malformed, stale, or wrong. */
export class WebhookVerificationError extends MytpeError {
  constructor(message: string) {
    super(message, "webhook_signature");
  }
}

interface ParsedSignature {
  t: number;
  v1: string;
}

/** Pull the timestamp and v1 hash out of the signature header. */
export function parseSignatureHeader(header: string): ParsedSignature | null {
  if (typeof header !== "string") return null;
  let t: number | undefined;
  let v1: string | undefined;
  for (const part of header.split(",")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key === "t") t = Number(value);
    else if (key === "v1") v1 = value;
  }
  if (t === undefined || !Number.isFinite(t) || !v1) return null;
  return { t, v1 };
}

function safeEqualHex(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * True when the signature header matches the raw body under the secret and is
 * within the timestamp tolerance. Pass the body exactly as it arrived on the
 * wire: re-serializing parsed JSON changes the bytes and breaks the hash.
 */
export function verifyWebhookSignature(
  rawBody: string,
  header: string,
  secret: string,
  options: VerifyOptions = {},
): boolean {
  const parsed = parseSignatureHeader(header);
  if (!parsed) return false;

  const tolerance = options.toleranceSeconds ?? 300;
  const nowSeconds = (options.now ?? Date.now()) / 1000;
  if (Math.abs(nowSeconds - parsed.t) > tolerance) return false;

  const expected = createHmac("sha256", secret)
    .update(`${parsed.t}.${rawBody}`)
    .digest("hex");
  return safeEqualHex(parsed.v1, expected);
}

/**
 * Verify a webhook and return its parsed event, or throw. Use this in your
 * handler: it does the signature check and the JSON parse in one step, so a
 * returned event is one you can trust.
 */
export function constructWebhookEvent(
  rawBody: string,
  header: string,
  secret: string,
  options: VerifyOptions = {},
): WebhookEvent {
  if (!verifyWebhookSignature(rawBody, header, secret, options)) {
    throw new WebhookVerificationError(
      "The webhook signature did not verify. Drop the request.",
    );
  }
  try {
    return JSON.parse(rawBody) as WebhookEvent;
  } catch {
    throw new WebhookVerificationError(
      "The webhook body verified but was not valid JSON.",
    );
  }
}
