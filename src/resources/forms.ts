// Forms: the checkout form a payment link can carry, built from sections and
// fields. A form is a draft until published, and only a published form can be
// attached to a link. Sections and fields are managed through their own nested
// endpoints. Selection fields need options, which is checked before sending.

import { Resource, segment, type Page } from "./base";
import { FieldIssues } from "../validate";
import type { FieldDataType, FormStatus, Timestamp, Uuid } from "../types";

/**
 * Translatable text, keyed by locale, such as `{ fr: "Wilaya", ar: "الولاية" }`.
 * Field labels and help text are stored this way. Where the SDK accepts a plain
 * string for convenience, it wraps it as `{ en: "..." }` before sending.
 */
export type LocaleText = Record<string, string>;

export interface FormFieldOption {
  value: string;
  /** A plain string, or translatable text. */
  label: string | LocaleText;
}

export interface FormField {
  id: Uuid;
  form_section_id: Uuid | null;
  input_name: string;
  /** Resolved to a string on read; written as translatable text. */
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
  /** The section title. A plain string is wrapped as `{ en: "..." }` for you. */
  title: string | LocaleText;
  /** A plain string is wrapped for you. */
  description?: string | LocaleText;
  position?: number;
}

export interface FieldInput {
  input_name: string;
  /** The field label. A plain string is wrapped as `{ en: "..." }` for you. */
  label: string | LocaleText;
  data_type: FieldDataType;
  is_required?: boolean;
  /** Help text shown under the field. A plain string is wrapped for you. */
  help_text?: string | LocaleText;
  validation_rules?: string;
  /** Required for select, multi_select, radio, and checkbox fields. */
  options?: FormFieldOption[];
  form_section_id?: Uuid;
  position?: number;
  meta?: Record<string, unknown>;
}

export type SectionUpdate = Partial<SectionInput>;

export type FieldUpdate = Partial<FieldInput>;

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

/** On create a selection field must carry options; on update, not an empty list. */
function validateField(input: FieldUpdate, creating: boolean): void {
  const issues = new FieldIssues();
  const missing =
    input.options === undefined ? creating : input.options.length === 0;
  if (input.data_type && NEEDS_OPTIONS.includes(input.data_type) && missing) {
    issues.add("options", `is required for ${input.data_type} fields`);
  }
  issues.throwIfAny();
}

function toLocaleText(value: string | LocaleText): LocaleText {
  return typeof value === "string" ? { en: value } : value;
}

/** Sections store title and description as translatable maps; wrap plain strings. */
function sectionPayload(input: SectionUpdate): Record<string, unknown> {
  const payload: Record<string, unknown> = { ...input };
  if (input.title !== undefined) payload.title = toLocaleText(input.title);
  if (input.description !== undefined) {
    payload.description = toLocaleText(input.description);
  }
  return payload;
}

/** The API stores label and help text as translatable maps; wrap plain strings. */
function fieldPayload(input: FieldUpdate): Record<string, unknown> {
  const payload: Record<string, unknown> = { ...input };
  if (input.label !== undefined) payload.label = toLocaleText(input.label);
  if (input.help_text !== undefined) {
    payload.help_text = toLocaleText(input.help_text);
  }
  return payload;
}

export class Forms extends Resource {
  list(params: FormListParams = {}, signal?: AbortSignal): Promise<Page<Form>> {
    return this.fetchPage<Form>("forms", { ...params }, signal);
  }

  paginate(params: FormListParams = {}, signal?: AbortSignal): AsyncGenerator<Form> {
    return this.iterate(this.list(params, signal));
  }

  create(input: FormCreate, signal?: AbortSignal): Promise<Form> {
    return this.post<Form>("forms", input, signal);
  }

  async get(id: Uuid, signal?: AbortSignal): Promise<Form> {
    return this.getData<Form>(`forms/${segment(id)}`, undefined, signal);
  }

  async update(id: Uuid, input: FormUpdate, signal?: AbortSignal): Promise<Form> {
    return this.patch<Form>(`forms/${segment(id)}`, input, signal);
  }

  /** Publish a draft form so it can be attached to links. */
  async publish(id: Uuid, signal?: AbortSignal): Promise<Form> {
    return this.post<Form>(`forms/${segment(id)}/publish`, undefined, signal);
  }

  async delete(id: Uuid, signal?: AbortSignal): Promise<void> {
    return this.remove(`forms/${segment(id)}`, signal);
  }

  async addSection(
    id: Uuid,
    input: SectionInput,
    signal?: AbortSignal,
  ): Promise<FormSection> {
    return this.post<FormSection>(
      `forms/${segment(id)}/sections`,
      sectionPayload(input),
      signal,
    );
  }

  async updateSection(
    id: Uuid,
    sectionId: Uuid,
    input: SectionUpdate,
    signal?: AbortSignal,
  ): Promise<FormSection> {
    return this.patch<FormSection>(
      `forms/${segment(id)}/sections/${segment(sectionId)}`,
      sectionPayload(input),
      signal,
    );
  }

  async deleteSection(id: Uuid, sectionId: Uuid, signal?: AbortSignal): Promise<void> {
    return this.remove(
      `forms/${segment(id)}/sections/${segment(sectionId)}`,
      signal,
    );
  }

  async addField(
    id: Uuid,
    input: FieldInput,
    signal?: AbortSignal,
  ): Promise<FormField> {
    validateField(input, true);
    return this.post<FormField>(
      `forms/${segment(id)}/fields`,
      fieldPayload(input),
      signal,
    );
  }

  async updateField(
    id: Uuid,
    fieldId: Uuid,
    input: FieldUpdate,
    signal?: AbortSignal,
  ): Promise<FormField> {
    validateField(input, false);
    return this.patch<FormField>(
      `forms/${segment(id)}/fields/${segment(fieldId)}`,
      fieldPayload(input),
      signal,
    );
  }

  async deleteField(id: Uuid, fieldId: Uuid, signal?: AbortSignal): Promise<void> {
    return this.remove(
      `forms/${segment(id)}/fields/${segment(fieldId)}`,
      signal,
    );
  }
}
