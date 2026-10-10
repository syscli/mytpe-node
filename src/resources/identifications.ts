// Identifications: the KYC document that says who the business is. It is the
// first link in the onboarding chain. A brand and a bank account both reference
// one, and a payment instance needs all three before it can accept payments.

import { Resource, segment, type Page } from "./base";
import { buildFormData, type FileInput } from "../upload";
import type { KycStatus, Timestamp, Uuid } from "../types";

export interface EstablishmentType {
  id: Uuid;
  name: string;
  slug: string;
}

export interface AuthorizationType {
  id: Uuid;
  name: string;
  slug: string;
}

export interface Activity {
  id: Uuid;
  name: string;
}

export interface Identification {
  id: Uuid;
  name: string;
  establishment_type: EstablishmentType;
  authorization_type: AuthorizationType | null;
  activity: Activity | null;
  has_file: boolean;
  file_path: string | null;
  status: KycStatus;
  reason: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface IdentificationCreate {
  name: string;
  establishment_type_id: Uuid;
  authorization_type_id: Uuid;
  activity_id?: Uuid;
  /** A PDF, up to 5 MB. */
  identification_file?: FileInput;
}

export type IdentificationUpdate = Partial<IdentificationCreate>;

export interface IdentificationListParams {
  page?: number;
  per_page?: number;
  search?: string;
  status?: KycStatus;
  establishment_type_id?: Uuid;
  sort_by?: "created_at" | "name" | "status";
  sort_dir?: "asc" | "desc";
}

function toForm(input: IdentificationCreate | IdentificationUpdate): FormData {
  const { identification_file, ...fields } = input;
  return buildFormData(fields, { identification_file });
}

export class Identifications extends Resource {
  list(
    params: IdentificationListParams = {},
    signal?: AbortSignal,
  ): Promise<Page<Identification>> {
    return this.fetchPage<Identification>("identifications", { ...params }, signal);
  }

  paginate(
    params: IdentificationListParams = {},
    signal?: AbortSignal,
  ): AsyncGenerator<Identification> {
    return this.iterate(this.list(params, signal));
  }

  create(input: IdentificationCreate, signal?: AbortSignal): Promise<Identification> {
    return this.post<Identification>("identifications", toForm(input), signal);
  }

  async get(id: Uuid, signal?: AbortSignal): Promise<Identification> {
    return this.getData<Identification>(
      `identifications/${segment(id)}`,
      undefined,
      signal,
    );
  }

  async update(
    id: Uuid,
    input: IdentificationUpdate,
    signal?: AbortSignal,
  ): Promise<Identification> {
    return this.put<Identification>(
      `identifications/${segment(id)}`,
      toForm(input),
      signal,
    );
  }

  async delete(id: Uuid, signal?: AbortSignal): Promise<void> {
    return this.remove(`identifications/${segment(id)}`, signal);
  }
}
