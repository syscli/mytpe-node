import { describe, it, expect, vi } from "vitest";
import { HttpClient, type FetchLike, type HttpClientConfig } from "../src/http";
import { Forms } from "../src/resources/forms";
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

describe("Forms", () => {
  it("creates a form and a section", async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      if (String(url).endsWith("/sections")) {
        return jsonResponse({ data: { id: "s1", form_id: "f1", title: "Delivery" } }, 201);
      }
      return jsonResponse({ data: { id: "f1", name: "Checkout", status: "draft" } }, 201);
    }) as unknown as FetchLike;

    const forms = new Forms(http(fetchImpl));
    const form = await forms.create({ name: "Checkout" });
    expect(form.id).toBe("f1");
    const section = await forms.addSection("f1", { title: "Delivery" });
    expect(section.id).toBe("s1");
    expect(fetchImpl.mock.calls[1]![1]!.method).toBe("POST");
  });

  it("requires options on a select field", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ data: {} }, 201));
    await expect(
      new Forms(http(fetchImpl)).addField("f1", {
        input_name: "size",
        label: "Size",
        data_type: "select",
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("adds a valid select field with options", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ data: { id: "fld1", input_name: "size", data_type: "select" } }, 201),
    );
    const field = await new Forms(http(fetchImpl)).addField("f1", {
      input_name: "size",
      label: "Size",
      data_type: "select",
      options: [{ value: "s", label: "Small" }],
    });
    expect(field.id).toBe("fld1");
  });

  it("patches a form via PATCH", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ data: { id: "f1", name: "Renamed", status: "draft" } }),
    );
    await new Forms(http(fetchImpl)).update("f1", { name: "Renamed" });
    expect(fetchImpl.mock.calls[0]![1]!.method).toBe("PATCH");
  });
});
