// Brands: the customer-facing identity (name, logo) tied to an identification.
// A brand carries its own KYC review, since the logo and document are checked.

import { Resource, segment, type Page } from "./base";
import { buildFormData, type FileInput } from "../upload";
import type { Identification } from "./identifications";
import type { KycStatus, Timestamp, Uuid } from "../types";

export interface Brand {
  id: Uuid;
  name: string;
  logo: string | null;
  file: string | null;
  status: KycStatus;
  reason: string | null;
  identification_id: Uuid;
  identification: Identification;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface BrandCreate {
  name: string;
  identification_id: Uuid;
  /** The brand logo image, up to 5 MB. */
  logo: FileInput;
  /** A supporting image, up to 5 MB. */
  file: FileInput;
}

export interface BrandUpdate {
  name?: string;
  identification_id?: Uuid;
  logo?: FileInput;
  file?: FileInput;
}

export interface BrandListParams {
  page?: number;
  per_page?: number;
  search?: string;
  sort_by?: string;
  sort_dir?: "asc" | "desc";
}

function toForm(input: BrandCreate | BrandUpdate): FormData {
  const { logo, file, ...fields } = input;
  return buildFormData(fields, { logo, file });
}

export class Brands extends Resource {
  list(params: BrandListParams = {}): Promise<Page<Brand>> {
    return this.fetchPage<Brand>("brands", { ...params });
  }

  paginate(params: BrandListParams = {}): AsyncGenerator<Brand> {
    return this.iterate(this.list(params));
  }

  create(input: BrandCreate, signal?: AbortSignal): Promise<Brand> {
    return this.post<Brand>("brands", toForm(input), signal);
  }

  async get(id: Uuid, signal?: AbortSignal): Promise<Brand> {
    return this.getData<Brand>(`brands/${segment(id)}`, undefined, signal);
  }

  async update(id: Uuid, input: BrandUpdate, signal?: AbortSignal): Promise<Brand> {
    return this.put<Brand>(`brands/${segment(id)}`, toForm(input), signal);
  }

  async delete(id: Uuid, signal?: AbortSignal): Promise<void> {
    return this.remove(`brands/${segment(id)}`, signal);
  }
}
