// The client. One instance holds the key pair and the transport, and exposes a
// resource per part of the API. Build it once and reuse it; the resources are
// thin and share the same HttpClient.

import { HttpClient, type FetchLike, type RetryConfig } from "./http";
import { AccountResource } from "./resources/account";
import { Identifications } from "./resources/identifications";
import { Brands } from "./resources/brands";
import { BankAccounts } from "./resources/bank-accounts";
import { Instances } from "./resources/instances";
import { PaymentLinks } from "./resources/links";
import { Forms } from "./resources/forms";
import { Webhooks } from "./resources/webhooks";
import type { Account } from "./types";

const DEFAULT_BASE_URL = "https://api.mytpe.app/api/ext";
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_RETRY: RetryConfig = { attempts: 3 };

export interface MytpeOptions {
  /** Your API key, `mtk_live_...`. */
  key: string;
  /** Your API secret, `mts_live_...`. */
  secret: string;
  /** Defaults to the production endpoint. */
  baseUrl?: string;
  /** Per-request timeout in milliseconds. Defaults to 30000. */
  timeoutMs?: number;
  /** Override the retry attempts; reads keep their default otherwise. */
  retry?: Partial<RetryConfig>;
  /** Supply a fetch for older runtimes or for tests. Defaults to the global. */
  fetch?: FetchLike;
}

export class Mytpe {
  readonly account: AccountResource;
  readonly identifications: Identifications;
  readonly brands: Brands;
  readonly bankAccounts: BankAccounts;
  readonly instances: Instances;
  readonly links: PaymentLinks;
  readonly forms: Forms;
  readonly webhooks: Webhooks;

  private readonly http: HttpClient;

  constructor(options: MytpeOptions) {
    if (!options.key || !options.secret) {
      throw new Error("MyTPE needs both an API key and an API secret.");
    }

    const fetchImpl = options.fetch ?? globalThis.fetch;
    if (typeof fetchImpl !== "function") {
      throw new Error(
        "No fetch is available. Run on Node 18+ or pass one in options.fetch.",
      );
    }

    this.http = new HttpClient({
      key: options.key,
      secret: options.secret,
      baseUrl: options.baseUrl ?? DEFAULT_BASE_URL,
      timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      retry: { ...DEFAULT_RETRY, ...options.retry },
      fetch: fetchImpl,
    });

    this.account = new AccountResource(this.http);
    this.identifications = new Identifications(this.http);
    this.brands = new Brands(this.http);
    this.bankAccounts = new BankAccounts(this.http);
    this.instances = new Instances(this.http);
    this.links = new PaymentLinks(this.http);
    this.forms = new Forms(this.http);
    this.webhooks = new Webhooks(this.http);
  }

  /** Shortcut for `account.me()`: the trader the key belongs to. */
  me(signal?: AbortSignal): Promise<Account> {
    return this.account.me(signal);
  }
}
