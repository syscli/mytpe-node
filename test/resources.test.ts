import { describe, it, expect, vi } from "vitest";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FetchLike } from "../src/http";
import { Mytpe } from "../src/client";
import { fileFromPath } from "../src/upload";

const BASE = "https://api.mytpe.app/api/ext/";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const page = { data: [{ id: "x1" }], meta: { current_page: 1, last_page: 1 } };

function client(response: () => Response) {
  const fetchImpl = vi.fn<FetchLike>(async () => response());
  const mytpe = new Mytpe({ key: "k", secret: "s", fetch: fetchImpl });
  return { mytpe, fetchImpl };
}

interface Case {
  name: string;
  call: (m: Mytpe) => Promise<unknown>;
  method: string;
  path: string;
  reply?: unknown;
  status?: number;
  expected?: unknown;
}

const one = { data: { id: "x1" } };

const cases: Case[] = [
  { name: "identifications.list", call: (m) => m.identifications.list({ status: "pending" }), method: "GET", path: "identifications?status=pending", reply: page },
  { name: "identifications.get", call: (m) => m.identifications.get("i1"), method: "GET", path: "identifications/i1", reply: one },
  { name: "identifications.delete", call: (m) => m.identifications.delete("i1"), method: "DELETE", path: "identifications/i1", status: 204 },
  { name: "brands.list", call: (m) => m.brands.list(), method: "GET", path: "brands", reply: page },
  { name: "brands.get", call: (m) => m.brands.get("b1"), method: "GET", path: "brands/b1", reply: one },
  { name: "brands.delete", call: (m) => m.brands.delete("b1"), method: "DELETE", path: "brands/b1", status: 204 },
  { name: "bankAccounts.list", call: (m) => m.bankAccounts.list(), method: "GET", path: "bank-accounts", reply: page },
  { name: "bankAccounts.get", call: (m) => m.bankAccounts.get("r1"), method: "GET", path: "bank-accounts/r1", reply: one },
  { name: "bankAccounts.delete", call: (m) => m.bankAccounts.delete("r1"), method: "DELETE", path: "bank-accounts/r1", status: 204 },
  { name: "instances.list", call: (m) => m.instances.list({ acceptance_status: "ready" }), method: "GET", path: "instances?acceptance_status=ready", reply: page },
  { name: "instances.delete", call: (m) => m.instances.delete("n1"), method: "DELETE", path: "instances/n1", status: 204 },
  { name: "links.list", call: (m) => m.links.list({ status: "active", per_page: 50 }), method: "GET", path: "links?status=active&per_page=50", reply: page },
  { name: "links.get", call: (m) => m.links.get("l1"), method: "GET", path: "links/l1", reply: one },
  { name: "links.update", call: (m) => m.links.update("l1", { title: "New" }), method: "PUT", path: "links/l1", reply: one },
  { name: "links.pause", call: (m) => m.links.pause("l1"), method: "POST", path: "links/l1/pause", reply: one },
  { name: "links.resume", call: (m) => m.links.resume("l1"), method: "POST", path: "links/l1/resume", reply: one },
  { name: "forms.list", call: (m) => m.forms.list(), method: "GET", path: "forms", reply: page },
  { name: "forms.get", call: (m) => m.forms.get("f1"), method: "GET", path: "forms/f1", reply: one },
  { name: "forms.publish", call: (m) => m.forms.publish("f1"), method: "POST", path: "forms/f1/publish", reply: one },
  { name: "forms.delete", call: (m) => m.forms.delete("f1"), method: "DELETE", path: "forms/f1", status: 204 },
  { name: "forms.deleteSection", call: (m) => m.forms.deleteSection("f1", "s1"), method: "DELETE", path: "forms/f1/sections/s1", status: 204 },
  { name: "forms.deleteField", call: (m) => m.forms.deleteField("f1", "d1"), method: "DELETE", path: "forms/f1/fields/d1", status: 204 },
  { name: "webhooks.list", call: (m) => m.webhooks.list(), method: "GET", path: "webhooks", reply: page },
  { name: "webhooks.events", call: (m) => m.webhooks.events(), method: "GET", path: "webhooks/events", reply: { data: [{ value: "transaction.paid", label: "Paid" }] } },
  { name: "webhooks.get", call: (m) => m.webhooks.get("w1"), method: "GET", path: "webhooks/w1", reply: one },
  { name: "webhooks.update", call: (m) => m.webhooks.update("w1", { is_active: false }), method: "PATCH", path: "webhooks/w1", reply: one },
  { name: "webhooks.deliveries", call: (m) => m.webhooks.deliveries("w1", { page: 2 }), method: "GET", path: "webhooks/w1/deliveries?page=2", reply: page },
  { name: "webhooks.redeliver", call: (m) => m.webhooks.redeliver("w1", "v1"), method: "POST", path: "webhooks/w1/deliveries/v1/redeliver", reply: { message: "Queued." }, expected: "Queued." },
];

describe("resource routes", () => {
  it.each(cases)("$name sends $method to its path", async (c) => {
    const { mytpe, fetchImpl } = client(() => jsonResponse(c.reply, c.status ?? 200));
    const result = await c.call(mytpe);
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe(BASE + c.path);
    expect(init!.method).toBe(c.method);
    if (c.expected !== undefined) expect(result).toEqual(c.expected);
    else if (c.status === 204) expect(result).toBeUndefined();
    else if (c.reply === page) expect((result as { data: unknown[] }).data).toHaveLength(1);
    else expect(result).toEqual((c.reply as { data: unknown }).data);
  });
});

describe("brands.create", () => {
  it("posts the name, identification, and both files as multipart", async () => {
    const { mytpe, fetchImpl } = client(() => jsonResponse(one, 201));
    await mytpe.brands.create({
      name: "Boutique Batna",
      identification_id: "i1",
      logo: { data: new Uint8Array([1]), filename: "logo.png", contentType: "image/png" },
      file: new Blob([new Uint8Array([2])]),
    });
    const init = fetchImpl.mock.calls[0]![1]!;
    const form = init.body as FormData;
    expect(init.method).toBe("POST");
    expect(form.get("name")).toBe("Boutique Batna");
    expect((form.get("logo") as File).name).toBe("logo.png");
    expect(form.get("file")).toBeInstanceOf(Blob);
    expect(form.has("_method")).toBe(false);
  });
});

describe("fileFromPath", () => {
  it("reads the bytes and takes the name from the path", async () => {
    const dir = await mkdtemp(join(tmpdir(), "mytpe-"));
    const path = join(dir, "rc.pdf");
    await writeFile(path, new Uint8Array([37, 80, 68, 70]));
    const file = await fileFromPath(path, "application/pdf");
    expect(file).toMatchObject({ filename: "rc.pdf", contentType: "application/pdf" });
    expect((file as { data: Uint8Array }).data).toEqual(new Uint8Array([37, 80, 68, 70]));
  });
});
