import { describe, it, expect, vi } from "vitest";
import {
  HttpClient,
  encodeQuery,
  buildHeaders,
  type FetchLike,
  type HttpClientConfig,
} from "../src/http";
import {
  AbortError,
  AuthError,
  NetworkError,
  ServiceError,
  TimeoutError,
} from "../src/errors";

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(body === undefined ? "" : JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

function client(fetchImpl: FetchLike, over: Partial<HttpClientConfig> = {}) {
  return new HttpClient({
    key: "mtk_test",
    secret: "mts_test",
    baseUrl: "https://api.mytpe.app/api/ext",
    fetch: fetchImpl,
    timeoutMs: 1000,
    retry: { attempts: 3 },
    ...over,
  });
}

describe("encodeQuery", () => {
  it("drops null/undefined and stringifies the rest", () => {
    expect(encodeQuery({ per_page: 15, search: "order", x: null, y: undefined })).toBe(
      "?per_page=15&search=order",
    );
    expect(encodeQuery({})).toBe("");
  });
});

describe("buildHeaders", () => {
  const config = {
    key: "k",
    secret: "s",
    baseUrl: "x",
    fetch: globalThis.fetch,
    timeoutMs: 0,
    retry: { attempts: 1 },
  };

  it("sends both auth headers and JSON content-type for an object body", () => {
    const h = buildHeaders(config, { a: 1 });
    expect(h["X-Api-Key"]).toBe("k");
    expect(h["X-Api-Secret"]).toBe("s");
    expect(h["Content-Type"]).toBe("application/json");
  });

  it("omits content-type for FormData so fetch sets the boundary", () => {
    const form = new FormData();
    form.set("name", "Boutique Batna");
    expect(buildHeaders(config, form)["Content-Type"]).toBeUndefined();
  });
});

describe("HttpClient.request", () => {
  it("builds the URL with the /api/ext prefix and both headers", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ data: { id: "u1" } }));
    const body = await client(fetchImpl).request<{ data: { id: string } }>(
      "GET",
      "me",
    );
    expect(body.data.id).toBe("u1");
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe("https://api.mytpe.app/api/ext/me");
    const headers = init?.headers as Record<string, string>;
    expect(headers["X-Api-Key"]).toBe("mtk_test");
    expect(headers["X-Api-Secret"]).toBe("mts_test");
  });

  it("sends a FormData body untouched", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ data: {} }, { status: 201 }));
    const form = new FormData();
    form.set("name", "Boutique");
    await client(fetchImpl).request("POST", "identifications", { body: form });
    expect(fetchImpl.mock.calls[0]![1]!.body).toBeInstanceOf(FormData);
  });

  it("throws a typed error from a failed response", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(
        {
          errors: [
            {
              status: "401",
              code: "INVALID_API_CREDENTIALS",
              title: "Invalid API credentials.",
              detail: null,
              meta: [],
            },
          ],
        },
        { status: 401 },
      ),
    );
    await expect(client(fetchImpl).request("GET", "me")).rejects.toBeInstanceOf(
      AuthError,
    );
  });

  it("surfaces a 422 as a ValidationError with the field map", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(
        {
          errors: [
            {
              status: "422",
              code: "VALIDATION_ERROR",
              title: "Validation failed",
              meta: { amount: ["required"] },
            },
          ],
        },
        { status: 422 },
      ),
    );
    await expect(
      client(fetchImpl).request("POST", "links", { body: {} }),
    ).rejects.toMatchObject({ fieldErrors: { amount: ["required"] } });
  });

  it("returns undefined for a 204 No Content", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 204 }));
    const out = await client(fetchImpl).request("DELETE", "webhooks/w1");
    expect(out).toBeUndefined();
  });

  it("retries a 5xx for GET but not for POST", async () => {
    const fail = () => jsonResponse({ error: "SERVICE_UNAVAILABLE" }, { status: 503 });

    const getFetch = vi
      .fn<FetchLike>()
      .mockResolvedValueOnce(fail())
      .mockResolvedValueOnce(jsonResponse({ data: { ok: true } }));
    await client(getFetch).request("GET", "me");
    expect(getFetch).toHaveBeenCalledTimes(2);

    const postFetch = vi.fn<FetchLike>().mockResolvedValue(fail());
    await expect(
      client(postFetch).request("POST", "links", { body: {} }),
    ).rejects.toBeInstanceOf(ServiceError);
    expect(postFetch).toHaveBeenCalledTimes(1);
  });

  it("times out a response whose body stalls", async () => {
    const stalled = vi.fn<FetchLike>(async (_url, init) => {
      const stream = new ReadableStream({
        start(c) {
          init!.signal!.addEventListener("abort", () => c.error(new Error("aborted")));
        },
      });
      return new Response(stream, { status: 200 });
    });
    await expect(
      client(stalled, { timeoutMs: 20, retry: { attempts: 1 } }).request("GET", "me"),
    ).rejects.toBeInstanceOf(TimeoutError);
  });

  it("wraps a caller abort as AbortError and does not retry it", async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchImpl = vi.fn<FetchLike>(async (_url, init) => {
      throw init!.signal!.reason;
    });
    const error = await client(fetchImpl)
      .request("GET", "me", { signal: controller.signal })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AbortError);
    expect((error as AbortError).code).toBe("aborted");
    expect((error as AbortError).cause).toBeDefined();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("removes its abort listener from a long-lived signal", async () => {
    const controller = new AbortController();
    const remove = vi.spyOn(controller.signal, "removeEventListener");
    const fetchImpl = vi.fn(async () => jsonResponse({ data: {} }));
    await client(fetchImpl).request("GET", "me", { signal: controller.signal });
    expect(remove).toHaveBeenCalledWith("abort", expect.any(Function));
  });

  it("wraps a transport failure as NetworkError", async () => {
    const boom = vi.fn<FetchLike>().mockRejectedValue(new Error("ECONNRESET"));
    await expect(
      client(boom).request("POST", "links", { body: {} }),
    ).rejects.toBeInstanceOf(NetworkError);
  });
});
