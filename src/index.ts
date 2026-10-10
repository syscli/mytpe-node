// Public entry point.
export const VERSION = "0.1.0";

export { Mytpe } from "./client";
export type { MytpeOptions } from "./client";

export { AccountResource } from "./resources/account";
export { Identifications } from "./resources/identifications";
export { Brands } from "./resources/brands";
export { BankAccounts } from "./resources/bank-accounts";
export { Instances } from "./resources/instances";
export { PaymentLinks } from "./resources/links";
export { Forms } from "./resources/forms";
export { Webhooks } from "./resources/webhooks";

export {
  MytpeError,
  AuthError,
  ForbiddenError,
  NotFoundError,
  BusinessError,
  ServiceError,
  NetworkError,
  TimeoutError,
  AbortError,
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
export type {
  PaymentInstance,
  InstanceActivation,
  InstanceActivationInput,
  InstanceUpdate,
  InstanceListParams,
} from "./resources/instances";
export type {
  PaymentLink,
  PaymentLinkCreate,
  PaymentLinkUpdate,
  PaymentLinkListParams,
} from "./resources/links";
export type {
  Form,
  FormField,
  FormFieldOption,
  FormSection,
  FormCreate,
  FormUpdate,
  SectionInput,
  FieldInput,
  FormListParams,
  LocaleText,
} from "./resources/forms";
export type {
  Webhook,
  WebhookCreate,
  WebhookUpdate,
  WebhookEventInfo,
  WebhookDelivery,
  WebhookListParams,
} from "./resources/webhooks";

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
