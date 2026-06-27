// The authenticated trader. A single read, handy for confirming the key works
// and reading the onboarding status before trying to create an instance.

import { Resource } from "./base";
import type { Account } from "../types";

export class AccountResource extends Resource {
  /** The trader the API key belongs to. */
  me(signal?: AbortSignal): Promise<Account> {
    return this.getData<Account>("me", undefined, signal);
  }
}
