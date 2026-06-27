import { describe, it, expect, vi } from "vitest";
import { HttpClient, type FetchLike, type HttpClientConfig } from "../src/http";
import { Identifications } from "../src/resources/identifications";
import { BankAccounts } from "../src/resources/bank-accounts";
import { buildFormData } from "../src/upload";
import { ValidationError } from "../src/errors";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function http(fetchImpl: FetchLike) {
  const config: HttpClientConfig = {
    key: "k",
    secret: "s",
    baseUrl: "https://api.mytpe.app/api/ext",
    fetch: fetchImpl,
    timeoutMs: 1000,
    retry: { attempts: 1 },
  };
  return new HttpClient(config);
}

describe("buildFormData", () => {
  it("skips null fields, stringifies objects, and attaches files", () => {
    const form = buildFormData(
      { name: "Boutique Batna", activity_id: null, meta: { a: 1 } },
      {
        identification_file: {
          data: new Uint8Array([1, 2, 3]),
          filename: "rc.pdf",
          contentType: "application/pdf",
        },
      },
    );
    expect(form.get("name")).toBe("Boutique Batna");
    expect(form.has("activity_id")).toBe(false);
    expect(form.get("meta")).toBe('{"a":1}');
    const file = form.get("identification_file");
    expect(file).toBeInstanceOf(Blob);
  });
});

describe("Identifications", () => {
  it("posts multipart and returns the created identification", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ data: { id: "id1", name: "Boutique Batna", status: "pending" } }, 201),
    );
    const created = await new Identifications(http(fetchImpl)).create({
      name: "Boutique Batna",
      establishment_type_id: "et1",
      authorization_type_id: "at1",
    });
    expect(created.id).toBe("id1");
    const init = fetchImpl.mock.calls[0]![1]!;
    expect(init.method).toBe("POST");
    expect(init.body).toBeInstanceOf(FormData);
    // The transport must not set a JSON content-type for multipart.
    expect((init.headers as Record<string, string>)["Content-Type"]).toBeUndefined();
  });
});

describe("BankAccounts", () => {
  it("rejects a non-20-digit RIB before sending", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ data: {} }));
    await expect(
      new BankAccounts(http(fetchImpl)).create({
        account_number: "12345",
        identification_id: "id1",
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("sends a valid RIB as JSON", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ data: { id: "b1", account_number: "0".repeat(20), status: "pending" } }, 201),
    );
    const created = await new BankAccounts(http(fetchImpl)).create({
      account_number: "0".repeat(20),
      identification_id: "id1",
    });
    expect(created.id).toBe("b1");
    expect(fetchImpl.mock.calls[0]![1]!.body).toBe(
      JSON.stringify({ account_number: "0".repeat(20), identification_id: "id1" }),
    );
  });
});
