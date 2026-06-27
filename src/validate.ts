// Client-side checks that run before a request leaves, so an obvious mistake
// fails at once instead of after a 422 round trip. The collected issues use the
// same field-to-messages shape the API returns, so a ValidationError looks the
// same whether the client or the server raised it.

import { ValidationError, type FieldErrors } from "./errors";

export class FieldIssues {
  private readonly map: FieldErrors = {};

  add(field: string, message: string): this {
    (this.map[field] ??= []).push(message);
    return this;
  }

  get any(): boolean {
    return Object.keys(this.map).length > 0;
  }

  /** Throw a ValidationError carrying every collected field message. */
  throwIfAny(summary = "The request did not pass validation."): void {
    if (this.any) throw new ValidationError(summary, { fieldErrors: this.map });
  }
}

/** A RIB account number: exactly 20 digits. The checksum is checked server-side. */
export function isRib(value: unknown): value is string {
  return typeof value === "string" && /^\d{20}$/.test(value);
}
