// Bank accounts: the RIB that settlement is paid out to, tied to an
// identification. It must be reviewed and accepted before it can back a payment
// instance, and it cannot be deleted while an instance depends on it.

import { Resource, segment, type Page } from "./base";
import { FieldIssues, isRib } from "../validate";
import type { Identification } from "./identifications";
import type { KycStatus, Timestamp, Uuid } from "../types";

export interface BankAccount {
  id: Uuid;
  account_number: string;
  bank_code: string;
  status: KycStatus;
  reason: string | null;
  identification_id: Uuid;
  identification: Pick<Identification, "id" | "name">;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface BankAccountCreate {
  /** A 20-digit RIB with a valid checksum. */
  account_number: string;
  identification_id: Uuid;
}

export type BankAccountUpdate = Partial<BankAccountCreate>;

export interface BankAccountListParams {
  page?: number;
  per_page?: number;
  search?: string;
  sort_by?: string;
  sort_dir?: "asc" | "desc";
}

function validate(input: BankAccountCreate | BankAccountUpdate): void {
  const issues = new FieldIssues();
  if (input.account_number !== undefined && !isRib(input.account_number)) {
    issues.add("account_number", "must be exactly 20 digits");
  }
  issues.throwIfAny();
}

export class BankAccounts extends Resource {
  list(params: BankAccountListParams = {}): Promise<Page<BankAccount>> {
    return this.fetchPage<BankAccount>("bank-accounts", { ...params });
  }

  paginate(params: BankAccountListParams = {}): AsyncGenerator<BankAccount> {
    return this.iterate(this.list(params));
  }

  async create(input: BankAccountCreate, signal?: AbortSignal): Promise<BankAccount> {
    validate(input);
    return this.post<BankAccount>("bank-accounts", input, signal);
  }

  async get(id: Uuid, signal?: AbortSignal): Promise<BankAccount> {
    return this.getData<BankAccount>(
      `bank-accounts/${segment(id)}`,
      undefined,
      signal,
    );
  }

  async update(
    id: Uuid,
    input: BankAccountUpdate,
    signal?: AbortSignal,
  ): Promise<BankAccount> {
    validate(input);
    return this.put<BankAccount>(
      `bank-accounts/${segment(id)}`,
      input,
      signal,
    );
  }

  async delete(id: Uuid, signal?: AbortSignal): Promise<void> {
    return this.remove(`bank-accounts/${segment(id)}`, signal);
  }
}
