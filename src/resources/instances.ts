// Payment instances: the virtual terminals that actually accept card payments.
// Creating one requests activation: it references an accepted identification,
// brand, and bank account, and returns a transaction for the SATIM licence fee
// (pay it at `form_url`). Once the licence is approved the instance turns ready.

import { Resource, type Page } from "./base";
import { buildFormData, type FileInput } from "../upload";
import type { Identification } from "./identifications";
import type { Brand } from "./brands";
import type { BankAccount } from "./bank-accounts";
import type {
  InstanceAcceptanceStatus,
  InstanceStatus,
  Money,
  Timestamp,
  Uuid,
} from "../types";

export interface PaymentInstance {
  id: Uuid;
  user_id: Uuid;
  title: string;
  logo: string | null;
  status: InstanceStatus;
  acceptance_status: InstanceAcceptanceStatus;
  acceptance_reason: string | null;
  identification_id: Uuid;
  brand_id: Uuid;
  bank_account_id: Uuid;
  identification?: Identification;
  brand?: Brand;
  bank_account?: BankAccount;
  created_at: Timestamp;
  updated_at: Timestamp;
}

/** What an activation request returns: the licence-fee transaction to pay. */
export interface InstanceActivation {
  transaction_id: Uuid;
  status: string;
  payment_method: string;
  amount: Money;
  currency: string;
  /** The gateway URL to pay the licence fee. */
  form_url: string;
}

export interface InstanceActivationInput {
  title: string;
  identification_id: Uuid;
  brand_id: Uuid;
  bank_account_id: Uuid;
  payment_method: "online" | "bank_transfer" | "cheque";
  /** Proof for a bank-transfer or cheque licence payment. JPG, PNG, or PDF, up to 5 MB. */
  payment_proof?: FileInput;
}

export interface InstanceUpdate {
  title?: string;
  identification_id?: Uuid;
  brand_id?: Uuid;
  bank_account_id?: Uuid;
  logo?: FileInput;
}

export interface InstanceListParams {
  page?: number;
  per_page?: number;
  search?: string;
  status?: InstanceStatus;
  acceptance_status?: InstanceAcceptanceStatus;
  identification_id?: Uuid;
  brand_id?: Uuid;
  bank_account_id?: Uuid;
  sort_by?: string;
  sort_dir?: "asc" | "desc";
}

export class Instances extends Resource {
  list(params: InstanceListParams = {}): Promise<Page<PaymentInstance>> {
    return this.fetchPage<PaymentInstance>("instances", { ...params });
  }

  paginate(params: InstanceListParams = {}): AsyncGenerator<PaymentInstance> {
    return this.iterate(this.list(params));
  }

  /** Request activation of a new instance. Returns the licence-fee transaction. */
  requestActivation(
    input: InstanceActivationInput,
    signal?: AbortSignal,
  ): Promise<InstanceActivation> {
    const { payment_proof, ...fields } = input;
    return this.post<InstanceActivation>(
      "instances",
      buildFormData(fields, { payment_proof }),
      signal,
    );
  }

  get(id: Uuid, signal?: AbortSignal): Promise<PaymentInstance> {
    return this.getData<PaymentInstance>(
      `instances/${encodeURIComponent(id)}`,
      undefined,
      signal,
    );
  }

  update(
    id: Uuid,
    input: InstanceUpdate,
    signal?: AbortSignal,
  ): Promise<PaymentInstance> {
    const { logo, ...fields } = input;
    return this.put<PaymentInstance>(
      `instances/${encodeURIComponent(id)}`,
      buildFormData(fields, { logo }),
      signal,
    );
  }

  delete(id: Uuid, signal?: AbortSignal): Promise<void> {
    return this.remove(`instances/${encodeURIComponent(id)}`, signal);
  }
}
