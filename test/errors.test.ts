import { describe, it, expect } from "vitest";
import {
  errorFromResponse,
  AuthError,
  NotFoundError,
  BusinessError,
  RequestError,
  ServiceError,
  ValidationError,
  MytpeError,
} from "../src/errors";

// The API answers with a JSON:API style errors array.
function apiError(status: string, code: string, title: string, meta: unknown = []) {
  return { errors: [{ status, code, title, detail: null, meta }] };
}

describe("errorFromResponse", () => {
  it("maps 401/404 and keeps the api code from the errors array", () => {
    const auth = errorFromResponse(
      401,
      apiError("401", "INVALID_API_CREDENTIALS", "Invalid API credentials."),
    );
    expect(auth).toBeInstanceOf(AuthError);
    expect(auth.code).toBe("INVALID_API_CREDENTIALS");
    expect(auth.message).toBe("Invalid API credentials.");

    const nf = errorFromResponse(
      404,
      apiError("404", "WEBHOOK_NOT_FOUND", "Webhook not found."),
    );
    expect(nf).toBeInstanceOf(NotFoundError);
    expect(nf.code).toBe("WEBHOOK_NOT_FOUND");
  });

  it("builds a ValidationError with the field map from the error meta on 422", () => {
    const err = errorFromResponse(
      422,
      apiError("422", "VALIDATION_ERROR", "Validation failed", {
        url: [
          "The url field must be a valid URL.",
          "The url field must start with one of the following: https://.",
        ],
        events: ["The events field is required."],
      }),
    );
    expect(err).toBeInstanceOf(ValidationError);
    const ve = err as ValidationError;
    expect(ve.fieldErrors.url).toHaveLength(2);
    expect(ve.messages).toHaveLength(3);
    expect(ve.code).toBe("VALIDATION_ERROR");
  });

  it("maps a 5xx to a ServiceError", () => {
    expect(
      errorFromResponse(503, apiError("503", "SERVICE_UNAVAILABLE", "down")),
    ).toBeInstanceOf(ServiceError);
  });

  it("maps 400 and 409 to a BusinessError and other 4xx to a RequestError", () => {
    const conflict = errorFromResponse(409, apiError("409", "LINK_NOT_ACTIVE", "Not active"));
    expect(conflict).toBeInstanceOf(BusinessError);
    expect(conflict.code).toBe("LINK_NOT_ACTIVE");
    expect(errorFromResponse(400, undefined)).toBeInstanceOf(BusinessError);
    const limited = errorFromResponse(429, undefined);
    expect(limited).toBeInstanceOf(RequestError);
    expect(limited.code).toBe("RATE_LIMITED");
  });

  it("falls back cleanly when there is no body", () => {
    const err = errorFromResponse(500, undefined);
    expect(err).toBeInstanceOf(ServiceError);
    expect(err).toBeInstanceOf(MytpeError);
    expect(err.status).toBe(500);
  });
});

describe("ValidationError", () => {
  it("flattens messages from a client-side construction", () => {
    const err = new ValidationError("check failed", {
      fieldErrors: { account_number: ["must be 20 digits"] },
    });
    expect(err.messages).toEqual(["must be 20 digits"]);
    expect(err.code).toBe("VALIDATION_ERROR");
  });
});
