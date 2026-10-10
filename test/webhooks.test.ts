import { describe, it, expect, vi } from "vitest";
import { createHmac } from "node:crypto";
import { HttpClient, type FetchLike, type HttpClientConfig } from "../src/http";
import { Webhooks } from "../src/resources/webhooks";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(body === undefined ? "" : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function http(fetchImpl: FetchLike) {
  const config: HttpClientConfig = {
    key: "k",
    secret: "s",
    baseUrl: "https://api.mytpe.app/api/ext",
    fetch: fetchImpl,
    timeoutMs: 1000,
    retry: { attempts: 1 },
  };
  return new HttpClient(config);
}

describe("Webhooks", () => {
  it("creates a webhook and merges the top-level one-time secret", async () => {
    // The API returns the secret alongside data, not inside it.
    const fetchImpl = vi.fn(async () =>
      jsonResponse(
        {
          data: {
            id: "w1",
            url: "https://shop.test/hook",
            events: ["transaction.paid"],
            is_active: true,
          },
          secret: "whsec_123",
        },
        201,
      ),
    );
    const webhook = await new Webhooks(http(fetchImpl)).create({
      url: "https://shop.test/hook",
      events: ["transaction.paid"],
    });
    expect(webhook.id).toBe("w1");
    expect(webhook.secret).toBe("whsec_123");
  });

  it("returns just the new secret from regenerateSecret", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ secret: "whsec_new" }));
    const secret = await new Webhooks(http(fetchImpl)).regenerateSecret("w1");
    expect(secret).toBe("whsec_new");
  });

  it("throws when regenerateSecret gets no secret back", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ message: "ok" }));
    await expect(
      new Webhooks(http(fetchImpl)).regenerateSecret("w1"),
    ).rejects.toMatchObject({ code: "MISSING_SECRET" });
  });

  it("deletes via a 204", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 204 }));
    await expect(new Webhooks(http(fetchImpl)).delete("w1")).resolves.toBeUndefined();
    expect(fetchImpl.mock.calls[0]![1]!.method).toBe("DELETE");
  });

  it("constructs an event from a valid signature", () => {
    const secret = "whsec_123";
    const body = JSON.stringify({
      event: "transaction.paid",
      created_at: "2026-06-09T12:34:56.000000Z",
      data: { id: "tx1", status: "paid", amount: "4500.00" },
    });
    const t = Math.floor(Date.now() / 1000);
    const v1 = createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
    const header = `t=${t},v1=${v1}`;

    const webhooks = new Webhooks(http(vi.fn() as unknown as FetchLike));
    expect(webhooks.verify(body, header, secret)).toBe(true);
    const event = webhooks.constructEvent(body, header, secret);
    expect(event.event).toBe("transaction.paid");
  });
});
