import { describe, it, expect, vi } from "vitest";
import { HttpClient, type FetchLike, type HttpClientConfig } from "../src/http";
import { Instances } from "../src/resources/instances";

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

describe("Instances", () => {
  it("requests activation and returns the licence-fee transaction", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(
        {
          data: {
            transaction_id: "tx1",
            status: "processing",
            payment_method: "online",
            amount: "5000.00",
            currency: "DZD",
            form_url: "https://gateway.test/pay/tx1",
          },
        },
        201,
      ),
    );
    const activation = await new Instances(http(fetchImpl)).requestActivation({
      title: "Caisse Batna",
      identification_id: "id1",
      brand_id: "br1",
      bank_account_id: "ba1",
      payment_method: "online",
    });
    expect(activation.transaction_id).toBe("tx1");
    expect(activation.form_url).toContain("/pay/tx1");
    expect(fetchImpl.mock.calls[0]![1]!.body).toBeInstanceOf(FormData);
  });

  it("retrieves an instance with its nested KYC objects", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        data: {
          id: "in1",
          title: "Caisse Batna",
          status: "active",
          acceptance_status: "ready",
          identification: { id: "id1", name: "Boutique Batna" },
        },
      }),
    );
    const instance = await new Instances(http(fetchImpl)).get("in1");
    expect(instance.acceptance_status).toBe("ready");
    expect(instance.identification?.name).toBe("Boutique Batna");
    expect(fetchImpl.mock.calls[0]![0]).toBe(
      "https://api.mytpe.app/api/ext/instances/in1",
    );
  });
});
