// The error hierarchy. Every failure the client raises is a MytpeError, so a
// caller can catch one type and branch on `instanceof` or the stable `code`.
// HTTP failures are mapped from the status and the `error` code in the body;
// a 422 carries the field map under `fieldErrors`. ValidationError is also
// raised client-side, before a request leaves.

/**
 * Machine-readable error codes. The API returns its own codes, such as
 * `VALIDATION_ERROR`, `INVALID_API_CREDENTIALS`, or `WEBHOOK_NOT_FOUND`, and they
 * are kept verbatim. `network`, `timeout`, and `aborted` are the codes the
 * client adds itself, for a request that never completed.
 */
export type MytpeErrorCode =
  | "VALIDATION_ERROR"
  | "INVALID_API_CREDENTIALS"
  | "network"
  | "timeout"
  | "aborted"
  | (string & {});

export interface MytpeErrorOptions {
  status?: number;
  /** The full parsed response body, kept so callers can read everything. */
  body?: unknown;
  cause?: unknown;
  /** Seconds from a Retry-After header, when the API sent one. */
  retryAfter?: number;
}

export class MytpeError extends Error {
  /** HTTP status, or undefined for a client-side or network error. */
  readonly status?: number;
  readonly code: MytpeErrorCode;
  readonly body: unknown;
  /** Seconds the API asked to wait before retrying, from Retry-After. */
  readonly retryAfter?: number;

  constructor(
    message: string,
    code: MytpeErrorCode,
    options: MytpeErrorOptions = {},
  ) {
    super(
      message,
      options.cause !== undefined ? { cause: options.cause } : undefined,
    );
    this.name = new.target.name;
    this.code = code;
    this.status = options.status;
    this.body = options.body;
    this.retryAfter = options.retryAfter;
  }
}

/** 401. The API key or secret is missing or wrong. */
export class AuthError extends MytpeError {}

/** 403. The credentials are valid but not allowed to do this. */
export class ForbiddenError extends MytpeError {}

/** 404. No resource with that id belongs to this account. */
export class NotFoundError extends MytpeError {}

/** 400 or 409. A rule the API enforces that is not a field-level problem. */
export class BusinessError extends MytpeError {}

/** 500 or 503. The API is unavailable or erroring; safe to retry a read later. */
export class ServiceError extends MytpeError {}

/** The request never completed: DNS, socket, or a dropped connection. */
export class NetworkError extends MytpeError {
  constructor(
    message: string,
    options: MytpeErrorOptions = {},
    code: MytpeErrorCode = "network",
  ) {
    super(message, code, options);
  }
}

/** The request ran past `timeoutMs`. A NetworkError, so reads retry it. */
export class TimeoutError extends NetworkError {
  constructor(message: string, options: MytpeErrorOptions = {}) {
    super(message, options, "timeout");
  }
}

/** The caller aborted the request through its AbortSignal. Never retried. */
export class AbortError extends MytpeError {
  constructor(message: string, options: MytpeErrorOptions = {}) {
    super(message, "aborted", options);
  }
}

/** Any other 4xx, such as a 429, that the client does not model on its own. */
export class RequestError extends MytpeError {}

/** A field error map: field name to the messages for that field. */
export type FieldErrors = Record<string, string[]>;

export interface ValidationErrorOptions extends MytpeErrorOptions {
  fieldErrors?: FieldErrors;
  /** The API code on a server 422; defaults to `validation` for client checks. */
  code?: MytpeErrorCode;
}

/**
 * A 422 from the API, or a client-side check. `fieldErrors` maps each field to
 * its messages, the way the API returns them, so a form can show errors inline.
 */
export class ValidationError extends MytpeError {
  readonly fieldErrors: FieldErrors;

  constructor(message: string, options: ValidationErrorOptions = {}) {
    super(message, options.code ?? "validation", options);
    this.fieldErrors = options.fieldErrors ?? {};
  }

  /** Every message across every field, flattened, for a quick log line. */
  get messages(): string[] {
    return Object.values(this.fieldErrors).flat();
  }
}

/** One entry in the API's JSON:API style `errors` array. */
interface ApiError {
  status?: string;
  code?: string;
  title?: string;
  detail?: string | null;
  meta?: unknown;
}

function readErrors(body: unknown): ApiError[] {
  if (body && typeof body === "object") {
    const list = (body as { errors?: unknown }).errors;
    if (Array.isArray(list)) return list as ApiError[];
  }
  return [];
}

/** Pull the field-to-messages map out of the error metas, on a 422. */
function readFieldErrors(errors: ApiError[]): FieldErrors {
  const out: FieldErrors = {};
  for (const error of errors) {
    const meta = error.meta;
    if (meta && typeof meta === "object" && !Array.isArray(meta)) {
      for (const [field, messages] of Object.entries(meta)) {
        out[field] = Array.isArray(messages)
          ? messages.map((m) => String(m))
          : [String(messages)];
      }
    }
  }
  return out;
}

/**
 * Build the right error from a failed response. The API answers with a JSON:API
 * `errors` array; the first entry gives the message and code, and on a 422 the
 * entries' `meta` holds the field map. The code is passed through verbatim.
 */
export function errorFromResponse(
  status: number,
  body: unknown,
  retryAfter?: number,
): MytpeError {
  const errors = readErrors(body);
  const first = errors[0] ?? {};
  const code = typeof first.code === "string" ? first.code : undefined;
  const text =
    first.title || first.detail || `Request failed with status ${status}.`;
  const options: MytpeErrorOptions = { status, body, retryAfter };

  if (status === 422) {
    return new ValidationError(text, {
      ...options,
      code: code ?? "VALIDATION_ERROR",
      fieldErrors: readFieldErrors(errors),
    });
  }
  if (status === 401) {
    return new AuthError(text, code ?? "INVALID_API_CREDENTIALS", options);
  }
  if (status === 403) return new ForbiddenError(text, code ?? "FORBIDDEN", options);
  if (status === 404) return new NotFoundError(text, code ?? "NOT_FOUND", options);
  if (status >= 500) {
    return new ServiceError(text, code ?? "SERVICE_UNAVAILABLE", options);
  }
  if (status === 400 || status === 409) {
    return new BusinessError(text, code ?? "BUSINESS_ERROR", options);
  }
  if (status === 429) return new RequestError(text, code ?? "RATE_LIMITED", options);
  return new RequestError(text, code ?? "REQUEST_ERROR", options);
}
