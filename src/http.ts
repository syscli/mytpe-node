// Low-level transport. Everything that touches the network goes through here:
// the two auth headers, query encoding, the timeout, the retry, JSON and
// multipart bodies, and turning a failed response into a typed error. Resources
// call `request` and never build a URL or read the raw envelope themselves.

import { errorFromResponse, NetworkError, ServiceError } from "./errors";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/** A fetch implementation compatible with the platform global. */
export type FetchLike = typeof globalThis.fetch;

export interface RetryConfig {
  /** Total attempts including the first. 1 disables retrying. */
  attempts: number;
}

/** The `links` block on a paginated list. */
export interface PageLinks {
  first: string | null;
  last: string | null;
  prev: string | null;
  next: string | null;
}

/** The `meta` block on a paginated list. */
export interface PageMeta {
  current_page: number;
  from: number | null;
  to: number | null;
  per_page: number;
  last_page: number;
  total: number;
}

export type QueryValue = string | number | boolean | null | undefined;
export type QueryParams = Record<string, QueryValue>;

export interface HttpClientConfig {
  key: string;
  secret: string;
  /** Trailing slash is optional; it is added if missing. */
  baseUrl: string;
  fetch: FetchLike;
  timeoutMs: number;
  retry: RetryConfig;
}

export interface RequestOptions {
  query?: QueryParams;
  /** A plain object is sent as JSON; a FormData is sent as multipart. */
  body?: unknown;
  signal?: AbortSignal;
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Turn a params object into a query string, including the leading `?`. Drops
 * `undefined` and `null`; booleans go over as `"true"` and `"false"`.
 */
export function encodeQuery(params: QueryParams | undefined): string {
  if (!params) return "";
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    parts.push(
      `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`,
    );
  }
  return parts.length ? `?${parts.join("&")}` : "";
}

function isFormData(body: unknown): body is FormData {
  return typeof FormData !== "undefined" && body instanceof FormData;
}

/**
 * The auth headers, plus Accept. Content-Type is set for a JSON body only;
 * for multipart it is left to fetch, which adds the boundary the server needs.
 */
export function buildHeaders(
  config: HttpClientConfig,
  body: unknown,
): Record<string, string> {
  const headers: Record<string, string> = {
    "X-Api-Key": config.key,
    "X-Api-Secret": config.secret,
    Accept: "application/json",
  };
  if (body !== undefined && !isFormData(body)) {
    headers["Content-Type"] = "application/json";
  }
  return headers;
}

export class HttpClient {
  private readonly config: HttpClientConfig;

  constructor(config: HttpClientConfig) {
    // new URL() drops the last path segment of a base without a trailing slash,
    // which would delete the `/api/ext` prefix. Pin the slash.
    this.config = {
      ...config,
      baseUrl: config.baseUrl.endsWith("/")
        ? config.baseUrl
        : `${config.baseUrl}/`,
    };
  }

  /**
   * Send a request and return the parsed body. Retries are narrow and read-only:
   * a 5xx or a dropped connection is retried for GET, since a write that timed
   * out may have gone through and a blind resend could double it.
   */
  async request<T>(
    method: HttpMethod,
    path: string,
    options: RequestOptions = {},
  ): Promise<T> {
    const maxAttempts = Math.max(1, this.config.retry.attempts);
    const idempotent = method === "GET";

    for (let attempt = 1; ; attempt++) {
      try {
        return await this.send<T>(method, path, options);
      } catch (error) {
        const retryable =
          idempotent &&
          (error instanceof ServiceError || error instanceof NetworkError);
        if (attempt >= maxAttempts || !retryable) throw error;
        await sleep(Math.min(2 ** (attempt - 1) * 500, 10_000));
      }
    }
  }

  private async send<T>(
    method: HttpMethod,
    path: string,
    options: RequestOptions,
  ): Promise<T> {
    const url = new URL(path, this.config.baseUrl);
    const target = `${url.toString()}${encodeQuery(options.query)}`;
    const headers = buildHeaders(this.config, options.body);

    const controller = new AbortController();
    const timer =
      this.config.timeoutMs > 0
        ? setTimeout(() => controller.abort(), this.config.timeoutMs)
        : undefined;
    if (options.signal) {
      if (options.signal.aborted) controller.abort();
      else
        options.signal.addEventListener("abort", () => controller.abort(), {
          once: true,
        });
    }

    let response: Response;
    try {
      response = await this.config.fetch(target, {
        method,
        headers,
        body: this.encodeBody(options.body),
        signal: controller.signal,
      });
    } catch (cause) {
      if (options.signal?.aborted) throw cause;
      const reason = cause instanceof Error ? cause.message : "request failed";
      throw new NetworkError(`Could not reach the API: ${reason}.`, { cause });
    } finally {
      if (timer) clearTimeout(timer);
    }

    const text = await response.text();
    let body: unknown;
    try {
      body = text ? JSON.parse(text) : undefined;
    } catch {
      body = text;
    }

    if (!response.ok) throw errorFromResponse(response.status, body);

    // 204 No Content and other empty bodies come back as undefined.
    return body as T;
  }

  private encodeBody(body: unknown): string | FormData | undefined {
    if (body === undefined) return undefined;
    if (isFormData(body)) return body;
    return JSON.stringify(body);
  }
}
