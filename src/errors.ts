// The error hierarchy. Every failure the client raises is a MytpeError, so a
// caller can catch one type and branch on `instanceof` or the stable `code`.
// HTTP failures are mapped from the status and the `error` code in the body;
// a 422 carries the field map under `fieldErrors`. ValidationError is also
// raised client-side, before a request leaves.

/**
 * Machine-readable error codes. The API's own codes (`error` field) are kept
 * verbatim. `validation` and `network` are the two the client adds itself.
 */
export type MytpeErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "BUSINESS_ERROR"
  | "SERVICE_UNAVAILABLE"
  | "validation"
  | "network"
  | (string & {});

export interface MytpeErrorOptions {
  status?: number;
  /** The full parsed response body, kept so callers can read everything. */
  body?: unknown;
  cause?: unknown;
}

export class MytpeError extends Error {
  /** HTTP status, or undefined for a client-side or network error. */
  readonly status?: number;
  readonly code: MytpeErrorCode;
  readonly body: unknown;

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
  }
}

/** 401. The API key or secret is missing or wrong. */
export class AuthError extends MytpeError {}

/** 403. The credentials are valid but not allowed to do this. */
export class ForbiddenError extends MytpeError {}

/** 404. No resource with that id belongs to this account. */
export class NotFoundError extends MytpeError {}

/** A rule the API enforces that is not a field-level validation problem. */
export class BusinessError extends MytpeError {}

/** 500 or 503. The API is unavailable or erroring; safe to retry a read later. */
export class ServiceError extends MytpeError {}

/** The request never reached the server: DNS, socket, or a timeout abort. */
export class NetworkError extends MytpeError {
  constructor(message: string, options: MytpeErrorOptions = {}) {
    super(message, "network", options);
  }
}

/** Any other 4xx the client does not model on its own. */
export class RequestError extends MytpeError {}

/** A field error map: field name to the messages for that field. */
export type FieldErrors = Record<string, string[]>;

export interface ValidationErrorOptions extends MytpeErrorOptions {
  fieldErrors?: FieldErrors;
}

/**
 * A 422 from the API, or a client-side check. `fieldErrors` maps each field to
 * its messages, the way the API returns them, so a form can show errors inline.
 */
export class ValidationError extends MytpeError {
  readonly fieldErrors: FieldErrors;

  constructor(message: string, options: ValidationErrorOptions = {}) {
    super(message, "validation", options);
    this.fieldErrors = options.fieldErrors ?? {};
  }

  /** Every message across every field, flattened, for a quick log line. */
  get messages(): string[] {
    return Object.values(this.fieldErrors).flat();
  }
}

interface ErrorBody {
  error?: string;
  message?: string;
  errors?: FieldErrors;
}

function readErrorBody(body: unknown): ErrorBody {
  if (body && typeof body === "object") {
    const b = body as ErrorBody;
    return {
      error: typeof b.error === "string" ? b.error : undefined,
      message: typeof b.message === "string" ? b.message : undefined,
      errors:
        b.errors && typeof b.errors === "object" ? b.errors : undefined,
    };
  }
  return {};
}

/**
 * Build the right error from a failed response. A 422 becomes a ValidationError
 * with its field map; the rest map from the status, keeping the API's `error`
 * code where it sent one so `error.code` matches the documentation.
 */
export function errorFromResponse(status: number, body: unknown): MytpeError {
  const { error, message, errors } = readErrorBody(body);
  const text = message ?? `Request failed with status ${status}.`;
  const options: MytpeErrorOptions = { status, body };

  if (status === 422) {
    return new ValidationError(text, { ...options, fieldErrors: errors ?? {} });
  }
  if (status === 401) return new AuthError(text, error ?? "UNAUTHORIZED", options);
  if (status === 403) return new ForbiddenError(text, error ?? "FORBIDDEN", options);
  if (status === 404) return new NotFoundError(text, error ?? "NOT_FOUND", options);
  if (status >= 500) {
    return new ServiceError(text, error ?? "SERVICE_UNAVAILABLE", options);
  }
  if (error === "BUSINESS_ERROR") return new BusinessError(text, error, options);
  return new RequestError(text, error ?? "BUSINESS_ERROR", options);
}
