import { describe, it, expect, vi } from "vitest";
import { HttpClient, type FetchLike, type HttpClientConfig } from "../src/http";
import { AccountResource } from "../src/resources/account";
import { Resource, type Page } from "../src/resources/base";
import { Webhooks } from "../src/resources/webhooks";
import { AbortError } from "../src/errors";

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
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

// A tiny concrete resource to exercise the protected list helpers.
class Things extends Resource {
  list(query = {}): Promise<Page<{ id: string }>> {
    return this.fetchPage<{ id: string }>("things", query);
  }
  all(): AsyncGenerator<{ id: string }> {
    return this.iterate(this.list());
  }
}

function listBody(page: number, lastPage: number, ids: string[]) {
  return {
    data: ids.map((id) => ({ id })),
    links: { first: "f", last: "l", prev: null, next: page < lastPage ? "n" : null },
    meta: {
      current_page: page,
      from: 1,
      to: ids.length,
      per_page: ids.length,
      last_page: lastPage,
      total: ids.length * lastPage,
    },
  };
}

describe("AccountResource", () => {
  it("reads the trader from me", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ data: { id: "t1", name: "Boutique Batna" } }),
    );
    const me = await new AccountResource(http(fetchImpl)).me();
    expect(me.id).toBe("t1");
    expect(fetchImpl.mock.calls[0]![0]).toBe("https://api.mytpe.app/api/ext/me");
  });
});

describe("pagination", () => {
  it("reports paging flags from meta", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(listBody(1, 3, ["a", "b"])));
    const page = await new Things(http(fetchImpl)).list();
    expect(page.data).toHaveLength(2);
    expect(page.meta.total).toBe(6);
    expect(page.hasMore).toBe(true);
  });

  it("walks every page through the iterator", async () => {
    const pages: Record<string, unknown> = {
      "1": listBody(1, 2, ["a", "b"]),
      "2": listBody(2, 2, ["c"]),
    };
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      const page = new URL(String(url)).searchParams.get("page") ?? "1";
      return jsonResponse(pages[page]);
    }) as unknown as FetchLike;

    const seen: string[] = [];
    for await (const thing of new Things(http(fetchImpl)).all()) seen.push(thing.id);
    expect(seen).toEqual(["a", "b", "c"]);
  });

  it("carries the caller signal to later pages", async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn<FetchLike>(async (_url, init) => {
      if (init?.signal?.aborted) throw init.signal.reason;
      controller.abort();
      return jsonResponse(listBody(1, 2, ["w1"]));
    });

    const seen: string[] = [];
    const walk = async () => {
      const hooks = new Webhooks(http(fetchImpl));
      for await (const hook of hooks.paginate({}, controller.signal)) seen.push(hook.id);
    };
    await expect(walk()).rejects.toBeInstanceOf(AbortError);
    expect(seen).toEqual(["w1"]);
  });
});
