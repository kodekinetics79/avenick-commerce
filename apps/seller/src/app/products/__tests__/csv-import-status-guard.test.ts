import { describe, expect, it } from "vitest";
import { SELLER_BULK_STATUSES, bulkTransitionBlocker } from "@/lib/product-status-transitions";

/**
 * The one rule both the bulk action and the CSV import obey when a seller
 * asks for a status. The CSV path used to write any listed status straight
 * onto the row; this pins the refusals the import must now report instead.
 */
const published = new Date("2026-01-01T00:00:00.000Z");

describe("seller status transition guard (bulk action and CSV import)", () => {
  it("only ever lets a seller ask for ACTIVE or INACTIVE", () => {
    expect([...SELLER_BULK_STATUSES]).toEqual(["ACTIVE", "INACTIVE"]);
  });

  it("refuses to bring an admin-suppressed listing back to ACTIVE", () => {
    expect(bulkTransitionBlocker("ACTIVE", { status: "SUPPRESSED", publishedAt: published })).toBe("PLATFORM_SUPPRESSED");
  });

  it("refuses to pause an admin-suppressed listing, so the suppression cannot be masked either way", () => {
    expect(bulkTransitionBlocker("INACTIVE", { status: "SUPPRESSED", publishedAt: published })).toBe("PLATFORM_SUPPRESSED");
  });

  it("treats a platform-suspended listing the same way, not as one awaiting approval", () => {
    expect(bulkTransitionBlocker("ACTIVE", { status: "SUSPENDED", publishedAt: published })).toBe("PLATFORM_SUPPRESSED");
    expect(bulkTransitionBlocker("INACTIVE", { status: "SUSPENDED", publishedAt: published })).toBe("PLATFORM_SUPPRESSED");
  });

  it("refuses to activate a DRAFT that was never approved", () => {
    expect(bulkTransitionBlocker("ACTIVE", { status: "DRAFT", publishedAt: null })).toBe("NOT_APPROVED_YET");
  });

  it("refuses to activate a listing still in review or already rejected", () => {
    expect(bulkTransitionBlocker("ACTIVE", { status: "PENDING_REVIEW", publishedAt: null })).toBe("NOT_APPROVED_YET");
    expect(bulkTransitionBlocker("ACTIVE", { status: "REJECTED", publishedAt: null })).toBe("NOT_APPROVED_YET");
  });

  it("refuses to activate a paused listing that carries no approval record", () => {
    // INACTIVE with publishedAt null never went through an approver.
    expect(bulkTransitionBlocker("ACTIVE", { status: "INACTIVE", publishedAt: null })).toBe("NOT_APPROVED_YET");
  });

  it("lets a seller pause a live listing", () => {
    expect(bulkTransitionBlocker("INACTIVE", { status: "ACTIVE", publishedAt: published })).toBeNull();
  });

  it("lets a seller resume a listing they paused after it was approved once", () => {
    expect(bulkTransitionBlocker("ACTIVE", { status: "INACTIVE", publishedAt: published })).toBeNull();
  });

  it("reports a no-op rather than writing the same status again", () => {
    expect(bulkTransitionBlocker("ACTIVE", { status: "ACTIVE", publishedAt: published })).toBe("ALREADY_IN_STATUS");
    expect(bulkTransitionBlocker("INACTIVE", { status: "INACTIVE", publishedAt: published })).toBe("ALREADY_IN_STATUS");
  });

  it("only lets a live listing be paused", () => {
    expect(bulkTransitionBlocker("INACTIVE", { status: "DRAFT", publishedAt: null })).toBe("NOT_PAUSABLE");
    expect(bulkTransitionBlocker("INACTIVE", { status: "PENDING_REVIEW", publishedAt: null })).toBe("NOT_PAUSABLE");
  });
});
