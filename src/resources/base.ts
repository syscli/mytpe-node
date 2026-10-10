// The shared base every resource extends. It holds the HttpClient and wraps the
// envelope so resources deal in entities, not `{ data }` wrappers. Single calls
// unwrap `data`; action calls return the `message`; lists come back as a Page
// you can step through or iterate.

import type { HttpClient, QueryParams, PageLinks, PageMeta } from "../http";
import { ValidationError } from "../errors";

/** One page of a list, with a `next()` that fetches the page after it. */
export interface Page<T> {
  data: T[];
  links: PageLinks;
  meta: PageMeta;
  /** True while a further page exists. */
  hasMore: boolean;
  next(): Promise<Page<T> | undefined>;
}

const EMPTY_META: PageMeta = {
  current_page: 1,
  from: null,
  to: null,
  per_page: 0,
  last_page: 1,
  total: 0,
};

const EMPTY_LINKS: PageLinks = { first: null, last: null, prev: null, next: null };

/** Encode an id as one path segment, refusing values that would change the route. */
export function segment(id: string): string {
  if (typeof id !== "string" || id === "" || id === "." || id === "..") {
    throw new ValidationError(`Invalid id: ${JSON.stringify(id)}.`, {
      fieldErrors: { id: ["must be a non-empty id"] },
    });
  }
  return encodeURIComponent(id);
}

export abstract class Resource {
  constructor(protected readonly http: HttpClient) {}

  /** GET a single resource and return its `data`. */
  protected getData<T>(
    path: string,
    query?: QueryParams,
    signal?: AbortSignal,
  ): Promise<T> {
    return this.unwrap<T>("GET", path, { query, signal });
  }

  /** POST a body and return the created resource's `data`. */
  protected post<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
    return this.unwrap<T>("POST", path, { body, signal });
  }

  /**
   * PUT a body and return the updated resource's `data`. PHP does not parse a
   * multipart body on PUT, so a FormData goes as POST with a `_method` override.
   */
  protected put<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
    if (typeof FormData !== "undefined" && body instanceof FormData) {
      body.set("_method", "PUT");
      return this.unwrap<T>("POST", path, { body, signal });
    }
    return this.unwrap<T>("PUT", path, { body, signal });
  }

  /** PATCH a body and return the updated resource's `data`. */
  protected patch<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
    return this.unwrap<T>("PATCH", path, { body, signal });
  }

  /**
   * Call an action endpoint that returns `{ message }` and hand back the text.
   * Falls back to an empty string when the endpoint returns no message.
   */
  protected async action(
    path: string,
    method: "POST" | "DELETE" = "POST",
    signal?: AbortSignal,
  ): Promise<string> {
    const body = await this.http.request<{ message?: string } | undefined>(
      method,
      path,
      { signal },
    );
    return body?.message ?? "";
  }

  /** DELETE a resource. The body, whether `{ message }` or 204, is discarded. */
  protected async remove(path: string, signal?: AbortSignal): Promise<void> {
    await this.http.request<unknown>("DELETE", path, { signal });
  }

  private async unwrap<T>(
    method: "GET" | "POST" | "PUT" | "PATCH",
    path: string,
    options: { query?: QueryParams; body?: unknown; signal?: AbortSignal },
  ): Promise<T> {
    const body = await this.http.request<{ data: T }>(method, path, options);
    return body.data;
  }

  /** Fetch one page of a list. `next()` reissues the request with the page bumped. */
  protected async fetchPage<T>(
    path: string,
    query: QueryParams = {},
    signal?: AbortSignal,
  ): Promise<Page<T>> {
    const body = await this.http.request<{
      data?: T[];
      links?: PageLinks;
      meta?: PageMeta;
    }>("GET", path, { query, signal });

    const meta = body.meta ?? EMPTY_META;
    const hasMore = meta.current_page < meta.last_page;
    return {
      data: body.data ?? [],
      links: body.links ?? EMPTY_LINKS,
      meta,
      hasMore,
      next: hasMore
        ? () =>
            this.fetchPage<T>(path, { ...query, page: meta.current_page + 1 }, signal)
        : async () => undefined,
    };
  }

  /** Walk every item across every page, starting from a first-page promise. */
  protected async *iterate<T>(first: Promise<Page<T>>): AsyncGenerator<T> {
    let page: Page<T> | undefined = await first;
    while (page) {
      for (const item of page.data) yield item;
      page = await page.next();
    }
  }
}
