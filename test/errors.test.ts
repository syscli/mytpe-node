import { describe, it, expect } from "vitest";
import {
  errorFromResponse,
  AuthError,
  ForbiddenError,
  NotFoundError,
  BusinessError,
  ServiceError,
  ValidationError,
  MytpeError,
} from "../src/errors";

describe("errorFromResponse", () => {
  it("maps 401/403/404 and keeps the api code", () => {
    expect(
      errorFromResponse(401, { error: "UNAUTHORIZED", message: "no" }),
    ).toBeInstanceOf(AuthError);
    expect(
      errorFromResponse(403, { error: "FORBIDDEN", message: "no" }),
    ).toBeInstanceOf(ForbiddenError);
    const nf = errorFromResponse(404, { error: "NOT_FOUND", message: "gone" });
    expect(nf).toBeInstanceOf(NotFoundError);
    expect(nf.code).toBe("NOT_FOUND");
    expect(nf.message).toBe("gone");
  });

  it("builds a ValidationError with the field map on 422", () => {
    const err = errorFromResponse(422, {
      message: "The given data was invalid.",
      errors: {
        amount: ["The amount field is required when amount mode is fixed."],
        payment_instance_id: ["The selected payment instance id is invalid."],
      },
    });
    expect(err).toBeInstanceOf(ValidationError);
    const ve = err as ValidationError;
    expect(ve.fieldErrors.amount).toHaveLength(1);
    expect(ve.messages).toHaveLength(2);
    expect(ve.code).toBe("validation");
  });

  it("maps a business error and 5xx", () => {
    expect(
      errorFromResponse(409, { error: "BUSINESS_ERROR", message: "rule" }),
    ).toBeInstanceOf(BusinessError);
    expect(
      errorFromResponse(503, { error: "SERVICE_UNAVAILABLE", message: "down" }),
    ).toBeInstanceOf(ServiceError);
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
  });
});
