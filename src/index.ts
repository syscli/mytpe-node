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

export type { Page } from "./resources/base";

export { fileFromPath, buildFormData } from "./upload";
export type { FileInput } from "./upload";

export { FieldIssues, isRib } from "./validate";

export type {
  Identification,
  EstablishmentType,
  AuthorizationType,
  Activity,
  IdentificationCreate,
  IdentificationUpdate,
  IdentificationListParams,
} from "./resources/identifications";
export type {
  Brand,
  BrandCreate,
  BrandUpdate,
  BrandListParams,
} from "./resources/brands";
export type {
  BankAccount,
  BankAccountCreate,
  BankAccountUpdate,
  BankAccountListParams,
} from "./resources/bank-accounts";

export { TERMINAL_LINK_STATUSES } from "./types";
export type {
  Money,
  Uuid,
  Timestamp,
  KycStatus,
  OnboardingStatus,
  InstanceAcceptanceStatus,
  InstanceStatus,
  LinkStatus,
  AmountMode,
  UsageMode,
  TransactionStatus,
  PaymentMethod,
  ConfirmationStatus,
  GatewayType,
  FormStatus,
  FieldDataType,
  Account,
} from "./types";
