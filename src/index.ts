// Public entry point. The client and resources are wired up in later steps.
export const VERSION = "0.1.0";

export {
  MytpeError,
  AuthError,
  ForbiddenError,
  NotFoundError,
  BusinessError,
  ServiceError,
  NetworkError,
  RequestError,
  ValidationError,
  errorFromResponse,
} from "./errors";
export type {
  MytpeErrorCode,
  MytpeErrorOptions,
  FieldErrors,
  ValidationErrorOptions,
} from "./errors";

export type {
  HttpMethod,
  FetchLike,
  RetryConfig,
  PageLinks,
  PageMeta,
} from "./http";

export {
  verifyWebhookSignature,
  constructWebhookEvent,
  parseSignatureHeader,
  WebhookVerificationError,
} from "./signature";
export type {
  WebhookEvent,
  WebhookEventData,
  VerifyOptions,
} from "./signature";
