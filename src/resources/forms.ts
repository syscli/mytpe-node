// Forms: the checkout form a payment link can carry, built from sections and
// fields. A form is a draft until published, and only a published form can be
// attached to a link. Sections and fields are managed through their own nested
// endpoints. Selection fields need options, which is checked before sending.

import { Resource, type Page } from "./base";
import { FieldIssues } from "../validate";
import type { FieldDataType, FormStatus, Timestamp, Uuid } from "../types";

export interface FormFieldOption {
  value: string;
  label: string;
}

export interface FormField {
  id: Uuid;
  form_section_id: Uuid | null;
  input_name: string;
  label: string;
  help_text: string | null;
  data_type: FieldDataType;
  is_required: boolean;
  validation_rules: string | null;
  options: FormFieldOption[];
  meta: Record<string, unknown> | unknown[];
  position: number;
}

export interface FormSection {
  id: Uuid;
  form_id: Uuid;
  title: string;
  description: string | null;
  position: number;
}

export interface Form {
  id: Uuid;
  trader_id: Uuid;
  name: string;
  description: string | null;
  industry: string | null;
  status: FormStatus;
  is_template: boolean;
  template_id: Uuid | null;
  meta: Record<string, unknown> | unknown[];
  sections?: FormSection[];
  fields?: FormField[];
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface FormCreate {
  name: string;
  description?: string;
  industry?: string;
  meta?: Record<string, unknown>;
}

export type FormUpdate = Partial<FormCreate>;

export interface SectionInput {
  title: string;
  description?: string;
  position?: number;
}

export interface FieldInput {
  input_name: string;
  label: string;
  data_type: FieldDataType;
  is_required?: boolean;
  help_text?: string;
  validation_rules?: string;
  /** Required for select, multi_select, radio, and checkbox fields. */
  options?: FormFieldOption[];
  form_section_id?: Uuid;
  position?: number;
  meta?: Record<string, unknown>;
}

export interface FormListParams {
  page?: number;
  per_page?: number;
}

const NEEDS_OPTIONS: readonly FieldDataType[] = [
  "select",
  "multi_select",
  "radio",
  "checkbox",
];

function validateField(input: FieldInput): void {
  const issues = new FieldIssues();
  if (
    NEEDS_OPTIONS.includes(input.data_type) &&
    (!input.options || input.options.length === 0)
  ) {
    issues.add("options", `is required for ${input.data_type} fields`);
  }
  issues.throwIfAny();
}

export class Forms extends Resource {
  list(params: FormListParams = {}): Promise<Page<Form>> {
    return this.fetchPage<Form>("forms", { ...params });
  }

  paginate(params: FormListParams = {}): AsyncGenerator<Form> {
    return this.iterate(this.list(params));
  }

  create(input: FormCreate, signal?: AbortSignal): Promise<Form> {
    return this.post<Form>("forms", input, signal);
  }

  get(id: Uuid, signal?: AbortSignal): Promise<Form> {
    return this.getData<Form>(`forms/${encodeURIComponent(id)}`, undefined, signal);
  }

  update(id: Uuid, input: FormUpdate, signal?: AbortSignal): Promise<Form> {
    return this.patch<Form>(`forms/${encodeURIComponent(id)}`, input, signal);
  }

  /** Publish a draft form so it can be attached to links. */
  publish(id: Uuid, signal?: AbortSignal): Promise<Form> {
    return this.post<Form>(`forms/${encodeURIComponent(id)}/publish`, undefined, signal);
  }

  delete(id: Uuid, signal?: AbortSignal): Promise<void> {
    return this.remove(`forms/${encodeURIComponent(id)}`, signal);
  }

  addSection(id: Uuid, input: SectionInput, signal?: AbortSignal): Promise<FormSection> {
    return this.post<FormSection>(`forms/${encodeURIComponent(id)}/sections`, input, signal);
  }

  updateSection(
    id: Uuid,
    sectionId: Uuid,
    input: SectionInput,
    signal?: AbortSignal,
  ): Promise<FormSection> {
    return this.patch<FormSection>(
      `forms/${encodeURIComponent(id)}/sections/${encodeURIComponent(sectionId)}`,
      input,
      signal,
    );
  }

  deleteSection(id: Uuid, sectionId: Uuid, signal?: AbortSignal): Promise<void> {
    return this.remove(
      `forms/${encodeURIComponent(id)}/sections/${encodeURIComponent(sectionId)}`,
      signal,
    );
  }

  async addField(id: Uuid, input: FieldInput, signal?: AbortSignal): Promise<FormField> {
    validateField(input);
    return this.post<FormField>(`forms/${encodeURIComponent(id)}/fields`, input, signal);
  }

  async updateField(
    id: Uuid,
    fieldId: Uuid,
    input: FieldInput,
    signal?: AbortSignal,
  ): Promise<FormField> {
    validateField(input);
    return this.patch<FormField>(
      `forms/${encodeURIComponent(id)}/fields/${encodeURIComponent(fieldId)}`,
      input,
      signal,
    );
  }

  deleteField(id: Uuid, fieldId: Uuid, signal?: AbortSignal): Promise<void> {
    return this.remove(
      `forms/${encodeURIComponent(id)}/fields/${encodeURIComponent(fieldId)}`,
      signal,
    );
  }
}
