// Shared types: the status enums the API uses across resources, plus a few small
// aliases that document intent. Resource-specific entities live with their
// resources; the enums live here because several resources share them.

/** Money is a decimal string such as "4500.00", in DZD unless stated otherwise. */
export type Money = string;
/** A UUID string. */
export type Uuid = string;
/** An ISO 8601 UTC timestamp string. */
export type Timestamp = string;

/** KYC review status on an identification, brand, or bank account. */
export type KycStatus = "pending" | "accepted" | "refused";

/** Where the account sits in onboarding. */
export type OnboardingStatus =
  | "not_started"
  | "kyc_in_progress"
  | "kyc_pending"
  | "kyc_rejected"
  | "kyc_approved"
  | "suspended"
  | "closed";

/** A payment instance's SATIM licence review state. */
export type InstanceAcceptanceStatus =
  | "pending_documents"
  | "documents_submitted"
  | "rejected"
  | "ready";

/** Whether an instance is operating. */
export type InstanceStatus = "active" | "suspended";

/** A payment link's lifecycle. The last three are terminal. */
export type LinkStatus =
  | "draft"
  | "active"
  | "paused"
  | "exhausted"
  | "expired"
  | "archived";

export type AmountMode = "fixed" | "open";

export type UsageMode =
  | "one_shot"
  | "limited"
  | "reusable"
  | "capped_amount"
  | "time_window"
  | "whitelist";

/** A transaction's outcome. `failed` covers refused, timed out, cancelled, errored. */
export type TransactionStatus = "processing" | "pending" | "paid" | "failed";

export type PaymentMethod = "free" | "online" | "bank_transfer" | "cheque";

export type ConfirmationStatus =
  | "requires_verification"
  | "confirmed"
  | "failed"
  | "rejected";

export type GatewayType = "satim" | "satim_epg" | "mastercard" | "poste_dz";

export type FormStatus = "draft" | "published" | "archived";

/** The input types a form field can take. */
export type FieldDataType =
  | "string"
  | "text"
  | "email"
  | "phone"
  | "url"
  | "integer"
  | "number"
  | "decimal"
  | "boolean"
  | "toggle"
  | "select"
  | "multi_select"
  | "radio"
  | "checkbox"
  | "date"
  | "time"
  | "datetime";

/** The link statuses past which a link can no longer be paid. */
export const TERMINAL_LINK_STATUSES: readonly LinkStatus[] = [
  "exhausted",
  "expired",
  "archived",
];

/** The authenticated trader, as returned by `me()`. */
export interface Account {
  id: Uuid;
  name?: string;
  email?: string;
  onboarding_status?: OnboardingStatus;
  created_at?: Timestamp;
  updated_at?: Timestamp;
  [key: string]: unknown;
}
