import { describe, it, expect, vi } from "vitest";
import { Mytpe } from "../src/client";
import type { FetchLike } from "../src/http";

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("Mytpe", () => {
  it("refuses to construct without a key and secret", () => {
    expect(() => new Mytpe({ key: "", secret: "s" })).toThrow(/key and an API secret/);
    expect(() => new Mytpe({ key: "k", secret: "" })).toThrow(/key and an API secret/);
  });

  it("exposes every resource", () => {
    const client = new Mytpe({ key: "k", secret: "s", fetch: globalThis.fetch });
    for (const name of [
      "account",
      "identifications",
      "brands",
      "bankAccounts",
      "instances",
      "links",
      "forms",
      "webhooks",
    ] as const) {
      expect(client[name]).toBeDefined();
    }
  });

  it("sends both auth headers to the v-ext base on a real call", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ data: { id: "t1", name: "Boutique Batna" } }),
    );
    const client = new Mytpe({ key: "mtk_x", secret: "mts_y", fetch: fetchImpl });
    const me = await client.me();
    expect(me.id).toBe("t1");

    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe("https://api.mytpe.app/api/ext/me");
    const headers = init?.headers as Record<string, string>;
    expect(headers["X-Api-Key"]).toBe("mtk_x");
    expect(headers["X-Api-Secret"]).toBe("mts_y");
  });
});
