import { describe, it, expect, vi } from "vitest";
import { HttpClient, type FetchLike, type HttpClientConfig } from "../src/http";
import { PaymentLinks } from "../src/resources/links";
import { ValidationError } from "../src/errors";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
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

const ok = () => jsonResponse({ data: { id: "l1", status: "draft" } }, 201);

describe("PaymentLinks.create validation", () => {
  it("requires an amount for a fixed link", async () => {
    const fetchImpl = vi.fn(ok);
    await expect(
      new PaymentLinks(http(fetchImpl)).create({
        payment_instance_id: "in1",
        title: "Order 1043",
        amount_mode: "fixed",
        usage_mode: "reusable",
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("collects every conditional miss at once", async () => {
    const fetchImpl = vi.fn(ok);
    await new PaymentLinks(http(fetchImpl))
      .create({
        payment_instance_id: "in1",
        title: "Order",
        amount_mode: "fixed",
        usage_mode: "time_window",
      })
      .catch((error: ValidationError) => {
        expect(Object.keys(error.fieldErrors).sort()).toEqual([
          "amount",
          "ends_at",
          "starts_at",
        ]);
      });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("sends a valid fixed reusable link", async () => {
    const fetchImpl = vi.fn(ok);
    const link = await new PaymentLinks(http(fetchImpl)).create({
      payment_instance_id: "in1",
      title: "Order 1043",
      amount_mode: "fixed",
      amount: 4500,
      usage_mode: "reusable",
    });
    expect(link.id).toBe("l1");
    expect(JSON.parse(fetchImpl.mock.calls[0]![1]!.body as string).amount).toBe(4500);
  });
});

describe("PaymentLinks actions", () => {
  it("publishes and returns the link", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ data: { id: "l1", slug: "abc", status: "active" } }),
    );
    const link = await new PaymentLinks(http(fetchImpl)).publish("l1");
    expect(link.status).toBe("active");
    expect(fetchImpl.mock.calls[0]![0]).toBe(
      "https://api.mytpe.app/api/ext/links/l1/publish",
    );
  });

  it("archives and returns the message", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ message: "Payment link archived." }),
    );
    const message = await new PaymentLinks(http(fetchImpl)).archive("l1");
    expect(message).toBe("Payment link archived.");
  });
});
