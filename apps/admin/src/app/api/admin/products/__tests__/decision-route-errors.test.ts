import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The product decision routes are a thin shell over approveProduct /
 * rejectProduct; what they own is the translation of the service's outcomes
 * into a body the page can act on. A stale queue must come back as 409 with
 * the row's real status, a reference to nothing as 404, and only the
 * unexpected as 500 — a 500 on a stale click would make the reviewer retry a
 * decision that can never land.
 */
const mocks = vi.hoisted(() => {
  // The route tells outcomes apart with instanceof, so the class the mock
  // exports must be the very one the test throws.
  class ProductNotPendingError extends Error {
    readonly productId: string;
    readonly currentStatus: string;
    constructor(productId: string, currentStatus: string) {
      super(`not pending: ${currentStatus}`);
      this.name = "ProductNotPendingError";
      this.productId = productId;
      this.currentStatus = currentStatus;
    }
  }
  return {
    ProductNotPendingError,
    getCurrentAdmin: vi.fn(),
    approveProduct: vi.fn(),
    rejectProduct: vi.fn(),
    logError: vi.fn(),
  };
});

vi.mock("@/lib/auth", () => ({ getCurrentAdmin: mocks.getCurrentAdmin }));
vi.mock("@avenick/database", () => ({
  ProductNotPendingError: mocks.ProductNotPendingError,
  approveProduct: mocks.approveProduct,
  rejectProduct: mocks.rejectProduct,
}));
vi.mock("@avenick/observability", () => ({ log: { error: mocks.logError } }));

import { PUT as approve } from "../[id]/approve/route";
import { PUT as reject } from "../[id]/reject/route";

const productId = "cprod00000000000001";
const adminId = "cadmin0000000000001";

function approveCall(id: string) {
  return approve(new Request(`https://admin.test/api/admin/products/${id}/approve`, { method: "PUT" }) as never, { params: { id } });
}

/** A request with no body at all — distinct from a body of `undefined`, which
 *  would take the default reason below and never exercise the empty case. */
const NO_BODY = Symbol("no body");

function rejectCall(id: string, body: unknown = { reason: "Images do not show the product" }) {
  const init: RequestInit = { method: "PUT", headers: { "Content-Type": "application/json" } };
  if (body !== NO_BODY) init.body = JSON.stringify(body);
  return reject(new Request(`https://admin.test/api/admin/products/${id}/reject`, init) as never, { params: { id } });
}

beforeEach(() => {
  // resetAllMocks, not clearAllMocks: clear leaves each mock's implementation in
  // place, so a mockRejectedValue set by one case still governed the next and a
  // 400 assertion could pass or fail on test order rather than on the route.
  vi.resetAllMocks();
  mocks.getCurrentAdmin.mockResolvedValue({ userId: adminId, role: "ADMIN" });
});

describe.each([
  { name: "approve", call: approveCall, service: () => mocks.approveProduct },
  { name: "reject", call: rejectCall, service: () => mocks.rejectProduct },
])("admin product $name route", ({ call, service }) => {
  it("answers 403 without an admin session and never reaches the service", async () => {
    mocks.getCurrentAdmin.mockResolvedValue(null);
    const response = await call(productId);
    expect(response.status).toBe(403);
    expect(service()).not.toHaveBeenCalled();
  });

  it("answers 404 for a non-record id before reaching the service", async () => {
    const response = await call("../not-a-record");
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ success: false });
    expect(service()).not.toHaveBeenCalled();
  });

  it("answers 409 with the row's current status when the listing was already decided", async () => {
    service().mockRejectedValue(new mocks.ProductNotPendingError(productId, "ACTIVE"));
    const response = await call(productId);
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body).toMatchObject({ success: false, currentStatus: "ACTIVE" });
    expect(body.error).toMatch(/already decided/);
    expect(body.error).toMatch(/reload/i);
    // A stale click is an expected outcome, not an incident.
    expect(mocks.logError).not.toHaveBeenCalled();
  });

  it("answers 404 when the service reports the listing does not exist", async () => {
    service().mockRejectedValue(new Error("Product not found"));
    const response = await call(productId);
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ success: false });
    expect(mocks.logError).not.toHaveBeenCalled();
  });

  it("answers 500 and logs for anything else", async () => {
    service().mockRejectedValue(new Error("connection reset"));
    const response = await call(productId);
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({ success: false });
    expect(mocks.logError).toHaveBeenCalledTimes(1);
  });
});

describe("admin product approve route", () => {
  it("passes the id and the acting admin to the service and returns its row", async () => {
    mocks.approveProduct.mockResolvedValue({ id: productId, status: "ACTIVE" });
    const response = await approveCall(productId);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ success: true, data: { id: productId, status: "ACTIVE" } });
    expect(mocks.approveProduct).toHaveBeenCalledWith(productId, adminId);
  });
});

describe("admin product reject route", () => {
  it("answers 400 without a reason and never reaches the service", async () => {
    for (const body of [NO_BODY, null, {}, { reason: "" }, { reason: "   " }, { reason: 42 }, "not an object"]) {
      const response = await rejectCall(productId, body);
      expect(response.status, String(typeof body === "symbol" ? "no body" : JSON.stringify(body))).toBe(400);
    }
    expect(mocks.rejectProduct).not.toHaveBeenCalled();
  });

  it("passes the trimmed reason to the service and returns its row", async () => {
    mocks.rejectProduct.mockResolvedValue({ id: productId, status: "REJECTED" });
    const response = await rejectCall(productId, { reason: "  Images do not show the product  " });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ success: true, data: { status: "REJECTED" } });
    expect(mocks.rejectProduct).toHaveBeenCalledWith(productId, adminId, "Images do not show the product");
  });
});
