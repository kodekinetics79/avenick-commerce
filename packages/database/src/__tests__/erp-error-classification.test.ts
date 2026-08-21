import { describe, it, expect } from "vitest";
import { ErpAdapterError, isRetryableIntegrationError } from "../services/erp-adapter";

describe("ERP failure classification", () => {
  it("marks a server error retryable", () => {
    const e = new ErpAdapterError("HTTP_500", "ERP HTTP 503", true);
    expect(isRetryableIntegrationError(e)).toBe(true);
  });

  it("marks a client error permanent", () => {
    // Retrying a 400 or 401 eight times with backoff cannot succeed and delays
    // the operator's discovery by hours.
    const e = new ErpAdapterError("HTTP_4XX", "ERP HTTP 401", false);
    expect(isRetryableIntegrationError(e)).toBe(false);
  });

  it("reports a client error as HTTP_4XX, not HTTP_500", () => {
    // Both ternary branches previously produced HTTP_500, so every 4xx was
    // logged and dead-lettered as a server fault.
    const e = new ErpAdapterError("HTTP_4XX", "ERP HTTP 404", false);
    expect(e.code).toBe("HTTP_4XX");
  });

  it("treats a timeout as retryable", () => {
    expect(isRetryableIntegrationError(new ErpAdapterError("TIMEOUT", "timed out", true))).toBe(true);
  });

  it("gives an unknown error class the benefit of the doubt", () => {
    // An unrecognised failure may well be transient; do not burn it on arrival.
    expect(isRetryableIntegrationError(new Error("socket hang up"))).toBe(true);
    expect(isRetryableIntegrationError("something odd")).toBe(true);
  });
});
