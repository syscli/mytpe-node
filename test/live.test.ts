// Live tests against the real API. They run only when MYTPE_API_KEY and
// MYTPE_API_SECRET are set, and are skipped otherwise, so the normal suite stays
// offline and fast.
//
//   MYTPE_API_KEY=mtk_... MYTPE_API_SECRET=mts_... npx vitest run test/live.test.ts
//
// Everything here is read-only: it lists resources and reads the account, so it
// never creates, charges, or deletes anything.

import { describe, it, expect } from "vitest";
import { Mytpe } from "../src/client";

const KEY = process.env.MYTPE_API_KEY;
const SECRET = process.env.MYTPE_API_SECRET;

const client = (): Mytpe => new Mytpe({ key: KEY ?? "", secret: SECRET ?? "" });

describe.skipIf(!KEY || !SECRET)("live reads", () => {
  it("reads the account", async () => {
    const me = await client().me();
    expect(me.id).toBeDefined();
    console.log(`live account: ${me.id}, onboarding ${me.onboarding_status}`);
  }, 20_000);

  it("lists each resource without error", async () => {
    const mytpe = client();
    const identifications = await mytpe.identifications.list();
    expect(Array.isArray(identifications.data)).toBe(true);

    const brands = await mytpe.brands.list();
    expect(Array.isArray(brands.data)).toBe(true);

    const banks = await mytpe.bankAccounts.list();
    expect(Array.isArray(banks.data)).toBe(true);

    const instances = await mytpe.instances.list();
    expect(Array.isArray(instances.data)).toBe(true);

    const links = await mytpe.links.list();
    expect(Array.isArray(links.data)).toBe(true);

    const forms = await mytpe.forms.list();
    expect(Array.isArray(forms.data)).toBe(true);

    const webhooks = await mytpe.webhooks.list();
    expect(Array.isArray(webhooks.data)).toBe(true);
  }, 30_000);

  it("lists the available webhook events", async () => {
    const events = await client().webhooks.events();
    expect(Array.isArray(events)).toBe(true);
  }, 20_000);
});
