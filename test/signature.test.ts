import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import {
  verifyWebhookSignature,
  constructWebhookEvent,
  parseSignatureHeader,
  WebhookVerificationError,
} from "../src/signature";

const SECRET = "whsec_test_secret";
const NOW = 1_733_745_296_000; // fixed ms

function sign(rawBody: string, t: number, secret = SECRET): string {
  const v1 = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
  return `t=${t},v1=${v1}`;
}

const body = JSON.stringify({
  event: "transaction.paid",
  created_at: "2026-06-09T12:34:56.000000Z",
  data: { id: "8e7d6c5b", status: "paid", amount: "4500.00", currency: "DZD" },
});

describe("parseSignatureHeader", () => {
  it("reads t and v1", () => {
    expect(parseSignatureHeader("t=123,v1=abcdef")).toEqual({
      t: 123,
      v1: "abcdef",
      signatures: ["abcdef"],
    });
  });
  it("rejects junk", () => {
    expect(parseSignatureHeader("nope")).toBeNull();
    expect(parseSignatureHeader("v1=abc")).toBeNull();
  });
});

describe("verifyWebhookSignature", () => {
  const t = Math.floor(NOW / 1000);

  it("accepts a correct signature within tolerance", () => {
    expect(verifyWebhookSignature(body, sign(body, t), SECRET, { now: NOW })).toBe(true);
  });

  it("rejects a tampered body", () => {
    const header = sign(body, t);
    expect(verifyWebhookSignature(body + " ", header, SECRET, { now: NOW })).toBe(false);
  });

  it("rejects a wrong secret", () => {
    expect(
      verifyWebhookSignature(body, sign(body, t), "whsec_other", { now: NOW }),
    ).toBe(false);
  });

  it("rejects a stale timestamp", () => {
    const old = Math.floor(NOW / 1000) - 600;
    expect(verifyWebhookSignature(body, sign(body, old), SECRET, { now: NOW })).toBe(
      false,
    );
  });

  it("accepts any of several v1 hashes during a secret rotation", () => {
    const good = sign(body, t).split("v1=")[1]!;
    const header = `t=${t},v1=${"0".repeat(64)},v1=${good}`;
    expect(verifyWebhookSignature(body, header, SECRET, { now: NOW })).toBe(true);
  });

  it("refuses to verify with an empty secret", () => {
    expect(() => verifyWebhookSignature(body, sign(body, t, ""), "", { now: NOW })).toThrow(
      WebhookVerificationError,
    );
  });

  it("rejects a malformed header", () => {
    expect(verifyWebhookSignature(body, "garbage", SECRET, { now: NOW })).toBe(false);
  });
});

describe("constructWebhookEvent", () => {
  const t = Math.floor(NOW / 1000);

  it("returns the parsed event when the signature is good", () => {
    const event = constructWebhookEvent(body, sign(body, t), SECRET, { now: NOW });
    expect(event.event).toBe("transaction.paid");
    expect(event.data.amount).toBe("4500.00");
  });

  it("throws when the signature is bad", () => {
    expect(() =>
      constructWebhookEvent(body, sign(body, t), "wrong", { now: NOW }),
    ).toThrow(WebhookVerificationError);
  });
});

describe("header shapes", () => {
  const t = Math.floor(NOW / 1000);

  it("takes the first value of a repeated header and rejects a missing one", () => {
    expect(verifyWebhookSignature(body, [sign(body, t)], SECRET, { now: NOW })).toBe(true);
    expect(verifyWebhookSignature(body, undefined, SECRET, { now: NOW })).toBe(false);
  });
});
