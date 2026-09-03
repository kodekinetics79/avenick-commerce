import { describe, expect, it } from "vitest";
import { RFQStatus, type Prisma } from "@prisma/client";
import { SELLER_RFQ_INBOX_WHERE, UNASSIGNED_RFQ_OPEN_STATUSES } from "../services/rfq";

// Pure unit test: the predicate object is evaluated in memory against
// hand-built rows. Nothing here touches the database — what is under test is
// that the seller dashboard badge and the seller RFQ list, which both use this
// one predicate, describe the same set of rows.

// Every status the generated client knows, so a value added to the enum later
// is exercised here rather than silently left out of the sweep.
const ALL_STATUSES = Object.values(RFQStatus);

it("sweeps a non-empty status set", () => {
  expect(ALL_STATUSES.length).toBeGreaterThan(0);
  expect(ALL_STATUSES).toEqual(expect.arrayContaining(["SUBMITTED", "UNDER_REVIEW", "QUOTED"]));
});

type Row = { sellerId: string | null; status: RFQStatus };

/**
 * Evaluates only the shapes SELLER_RFQ_INBOX_WHERE is allowed to use: a
 * top-level OR of arms that filter on `sellerId` (null or exact) and
 * `status: { in }`. Any other shape fails loudly so a future rewrite of the
 * predicate has to update this test rather than silently pass it.
 */
function matches(where: Prisma.RFQRequestWhereInput, row: Row): boolean {
  const keys = Object.keys(where);
  expect(keys).toEqual(["OR"]);
  const arms = where.OR;
  if (!Array.isArray(arms)) throw new Error("expected OR to be an array");
  return arms.some((arm) => {
    for (const key of Object.keys(arm)) {
      if (key !== "sellerId" && key !== "status") throw new Error(`unexpected predicate key ${key}`);
    }
    if ("sellerId" in arm) {
      const expected = arm.sellerId;
      if (expected !== null && typeof expected !== "string") throw new Error("unexpected sellerId filter");
      if (row.sellerId !== expected) return false;
    }
    if ("status" in arm) {
      const filter = arm.status;
      if (!filter || typeof filter !== "object" || !("in" in filter) || !Array.isArray(filter.in)) {
        throw new Error("unexpected status filter");
      }
      if (!filter.in.includes(row.status)) return false;
    }
    return true;
  });
}

describe("SELLER_RFQ_INBOX_WHERE", () => {
  const me = "seller_me";
  const other = "seller_other";
  const where = SELLER_RFQ_INBOX_WHERE(me);

  it("includes unclaimed RFQs only while they are open to quotes", () => {
    for (const status of ALL_STATUSES) {
      const open = (UNASSIGNED_RFQ_OPEN_STATUSES as readonly RFQStatus[]).includes(status);
      expect(matches(where, { sellerId: null, status }), status).toBe(open);
    }
  });

  it("names exactly the two pre-quote statuses as open", () => {
    expect([...UNASSIGNED_RFQ_OPEN_STATUSES].sort()).toEqual(["SUBMITTED", "UNDER_REVIEW"]);
  });

  it("includes every RFQ this seller has claimed, whatever its status now", () => {
    for (const status of ALL_STATUSES) {
      expect(matches(where, { sellerId: me, status }), status).toBe(true);
    }
  });

  it("never includes an RFQ another seller has claimed", () => {
    for (const status of ALL_STATUSES) {
      expect(matches(where, { sellerId: other, status }), status).toBe(false);
    }
  });

  it("builds a fresh predicate per seller rather than sharing one object", () => {
    const a = SELLER_RFQ_INBOX_WHERE("a");
    const b = SELLER_RFQ_INBOX_WHERE("b");
    expect(a).not.toBe(b);
    expect(matches(a, { sellerId: "a", status: "QUOTED" })).toBe(true);
    expect(matches(b, { sellerId: "a", status: "QUOTED" })).toBe(false);
  });
});
