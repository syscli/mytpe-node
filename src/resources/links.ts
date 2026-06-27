// Payment links: a shareable URL that collects card payments against an instance.
// The create call has conditional rules (an amount when the mode is fixed, a cap
// when the mode is capped, a window when timed, and so on); those are checked
// here before the request leaves, so a mistake comes back as a field error
// without a round trip. A link moves through publish, pause, resume, and archive.

import { Resource, type Page } from "./base";
import { FieldIssues } from "../validate";
import type {
  AmountMode,
  LinkStatus,
  Money,
  Timestamp,
  UsageMode,
  Uuid,
} from "../types";

export interface PaymentLink {
  id: Uuid;
  payment_instance_id: Uuid;
  form_id: Uuid | null;
  slug: string;
  title: string;
  description: string | null;
  logo: string | null;
  amount_mode: AmountMode;
  amount: Money | null;
  min_amount: Money | null;
  max_amount: Money | null;
  currency: string | null;
  usage_mode: UsageMode;
  max_uses: number | null;
  target_amount: number | null;
  starts_at: Timestamp | null;
  ends_at: Timestamp | null;
  expires_at: Timestamp | null;
  paid_count: number;
  total_collected: Money;
  status: LinkStatus;
  metadata: Record<string, unknown> | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface PaymentLinkCreate {
  payment_instance_id: Uuid;
  title: string;
  description?: string;
  form_id?: Uuid;
  amount_mode: AmountMode;
  /** Required when `amount_mode` is `fixed`. */
  amount?: number;
  min_amount?: number;
  max_amount?: number;
  currency?: string;
  usage_mode: UsageMode;
  /** Required when `usage_mode` is `limited`. */
  max_uses?: number;
  /** Required when `usage_mode` is `capped_amount`. */
  target_amount?: number;
  /** Required, with `ends_at`, when `usage_mode` is `time_window`. */
  starts_at?: string;
  ends_at?: string;
  expires_at?: string;
  /** Required when `usage_mode` is `whitelist`. */
  allowed_payers?: string[];
  metadata?: Record<string, unknown>;
}

export interface PaymentLinkUpdate {
  title?: string;
  description?: string;
  form_id?: Uuid;
  max_uses?: number;
  target_amount?: number;
  expires_at?: string;
  metadata?: Record<string, unknown>;
}

export interface PaymentLinkListParams {
  page?: number;
  per_page?: number;
  payment_instance_id?: Uuid;
  status?: LinkStatus;
  usage_mode?: UsageMode;
  search?: string;
  sort_by?: string;
  sort_dir?: "asc" | "desc";
}

function validateCreate(input: PaymentLinkCreate): void {
  const issues = new FieldIssues();

  if (input.amount_mode === "fixed" && input.amount === undefined) {
    issues.add("amount", "is required when amount_mode is fixed");
  }
  if (input.usage_mode === "limited" && input.max_uses === undefined) {
    issues.add("max_uses", "is required when usage_mode is limited");
  }
  if (input.usage_mode === "capped_amount" && input.target_amount === undefined) {
    issues.add("target_amount", "is required when usage_mode is capped_amount");
  }
  if (input.usage_mode === "time_window") {
    if (!input.starts_at) issues.add("starts_at", "is required when usage_mode is time_window");
    if (!input.ends_at) issues.add("ends_at", "is required when usage_mode is time_window");
  }
  if (
    input.usage_mode === "whitelist" &&
    (!input.allowed_payers || input.allowed_payers.length === 0)
  ) {
    issues.add("allowed_payers", "is required when usage_mode is whitelist");
  }

  issues.throwIfAny("The payment link did not pass validation.");
}

export class PaymentLinks extends Resource {
  list(params: PaymentLinkListParams = {}): Promise<Page<PaymentLink>> {
    return this.fetchPage<PaymentLink>("links", { ...params });
  }

  paginate(params: PaymentLinkListParams = {}): AsyncGenerator<PaymentLink> {
    return this.iterate(this.list(params));
  }

  async create(input: PaymentLinkCreate, signal?: AbortSignal): Promise<PaymentLink> {
    validateCreate(input);
    return this.post<PaymentLink>("links", input, signal);
  }

  get(id: Uuid, signal?: AbortSignal): Promise<PaymentLink> {
    return this.getData<PaymentLink>(`links/${encodeURIComponent(id)}`, undefined, signal);
  }

  update(id: Uuid, input: PaymentLinkUpdate, signal?: AbortSignal): Promise<PaymentLink> {
    return this.put<PaymentLink>(`links/${encodeURIComponent(id)}`, input, signal);
  }

  /** Publish a draft link so it can take payments. */
  publish(id: Uuid, signal?: AbortSignal): Promise<PaymentLink> {
    return this.post<PaymentLink>(`links/${encodeURIComponent(id)}/publish`, undefined, signal);
  }

  /** Pause an active link. */
  pause(id: Uuid, signal?: AbortSignal): Promise<PaymentLink> {
    return this.post<PaymentLink>(`links/${encodeURIComponent(id)}/pause`, undefined, signal);
  }

  /** Resume a paused link. */
  resume(id: Uuid, signal?: AbortSignal): Promise<PaymentLink> {
    return this.post<PaymentLink>(`links/${encodeURIComponent(id)}/resume`, undefined, signal);
  }

  /** Archive a link for good. Returns the API's confirmation message. */
  archive(id: Uuid, signal?: AbortSignal): Promise<string> {
    return this.action(`links/${encodeURIComponent(id)}/archive`, "POST", signal);
  }
}
