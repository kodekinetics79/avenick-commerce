import { describe, expect, it } from "vitest";
import { documentIsInDate, selectGoverningDocuments, type SelectableDocument } from "../document-selection";

// A fixed clock so "in date" and "expired" are decided the same way on every run.
const NOW = new Date("2026-06-15T12:00:00.000Z");
const PAST = new Date("2026-01-01T00:00:00.000Z");
const FUTURE = new Date("2027-01-01T00:00:00.000Z");

type Row = SelectableDocument & { id: string; fileName: string };

let seq = 0;
function row(
  overrides: Partial<Row> & { status: Row["status"]; uploadedAt: Date },
): Row {
  seq += 1;
  return {
    id: `doc-${seq}`,
    fileName: `file-${seq}.pdf`,
    type: "TRADE_LICENSE",
    expiryDate: null,
    ...overrides,
  };
}

const day = (offsetDays: number) => new Date(NOW.getTime() + offsetDays * 24 * 60 * 60 * 1000);

describe("documentIsInDate", () => {
  it("treats a null expiry as in date", () => {
    expect(documentIsInDate({ expiryDate: null }, NOW)).toBe(true);
  });

  it("treats an expiry in the future as in date and one in the past as expired", () => {
    expect(documentIsInDate({ expiryDate: FUTURE }, NOW)).toBe(true);
    expect(documentIsInDate({ expiryDate: PAST }, NOW)).toBe(false);
  });

  it("expires at the exact instant of expiry, matching effectiveDocumentStatus", () => {
    expect(documentIsInDate({ expiryDate: new Date(NOW.getTime()) }, NOW)).toBe(false);
    expect(documentIsInDate({ expiryDate: new Date(NOW.getTime() + 1) }, NOW)).toBe(true);
  });
});

describe("selectGoverningDocuments", () => {
  it("returns an empty map when the seller has no documents", () => {
    expect(selectGoverningDocuments([], NOW).size).toBe(0);
  });

  it("uses the only row for a type, with no renewal, whatever its status", () => {
    const pending = row({ status: "PENDING_REVIEW", uploadedAt: day(-1) });
    const result = selectGoverningDocuments([pending], NOW).get("TRADE_LICENSE");
    expect(result?.governing).toBe(pending);
    expect(result?.renewal).toBeNull();
  });

  it("keeps an in-date APPROVED row governing when a newer PENDING_REVIEW renewal is filed", () => {
    const approved = row({ status: "APPROVED", uploadedAt: day(-30), expiryDate: FUTURE });
    const renewal = row({ status: "PENDING_REVIEW", uploadedAt: day(-1), expiryDate: FUTURE });
    const result = selectGoverningDocuments([renewal, approved], NOW).get("TRADE_LICENSE");
    expect(result?.governing).toBe(approved);
    expect(result?.renewal).toBe(renewal);
  });

  it("treats an APPROVED row with no expiry as in date", () => {
    const approved = row({ status: "APPROVED", uploadedAt: day(-30), expiryDate: null });
    const renewal = row({ status: "PENDING_REVIEW", uploadedAt: day(-1) });
    const result = selectGoverningDocuments([renewal, approved], NOW).get("TRADE_LICENSE");
    expect(result?.governing).toBe(approved);
    expect(result?.renewal).toBe(renewal);
  });

  it("falls back to the newest row when the only APPROVED row has expired", () => {
    const expired = row({ status: "APPROVED", uploadedAt: day(-400), expiryDate: PAST });
    const renewal = row({ status: "PENDING_REVIEW", uploadedAt: day(-1) });
    const result = selectGoverningDocuments([expired, renewal], NOW).get("TRADE_LICENSE");
    expect(result?.governing).toBe(renewal);
    expect(result?.renewal).toBeNull();
  });

  it("falls back to the newest row when nothing is APPROVED", () => {
    const older = row({ status: "REJECTED", uploadedAt: day(-10) });
    const newer = row({ status: "REJECTED", uploadedAt: day(-2) });
    const result = selectGoverningDocuments([older, newer], NOW).get("TRADE_LICENSE");
    expect(result?.governing).toBe(newer);
    expect(result?.renewal).toBeNull();
  });

  it("prefers the newest in-date APPROVED row when several exist", () => {
    const first = row({ status: "APPROVED", uploadedAt: day(-300), expiryDate: FUTURE });
    const second = row({ status: "APPROVED", uploadedAt: day(-5), expiryDate: FUTURE });
    const result = selectGoverningDocuments([first, second], NOW).get("TRADE_LICENSE");
    expect(result?.governing).toBe(second);
    expect(result?.renewal).toBeNull();
  });

  it("reports a newer REJECTED row as the renewal so a refused renewal is not hidden behind the approval", () => {
    const approved = row({ status: "APPROVED", uploadedAt: day(-30), expiryDate: FUTURE });
    const rejected = row({ status: "REJECTED", uploadedAt: day(-1) });
    const result = selectGoverningDocuments([approved, rejected], NOW).get("TRADE_LICENSE");
    expect(result?.governing).toBe(approved);
    expect(result?.renewal).toBe(rejected);
  });

  it("reports the re-filed renewal, not the earlier refused one, when the seller tries again", () => {
    const approved = row({ status: "APPROVED", uploadedAt: day(-30), expiryDate: FUTURE });
    const refused = row({ status: "REJECTED", uploadedAt: day(-5) });
    const refiled = row({ status: "PENDING_REVIEW", uploadedAt: day(-1) });
    const result = selectGoverningDocuments([approved, refused, refiled], NOW).get("TRADE_LICENSE");
    expect(result?.governing).toBe(approved);
    expect(result?.renewal).toBe(refiled);
  });

  it("never reports a renewal when the governing row is the newest of its type", () => {
    const refused = row({ status: "REJECTED", uploadedAt: day(-5) });
    const expired = row({ status: "APPROVED", uploadedAt: day(-1), expiryDate: PAST });
    const result = selectGoverningDocuments([refused, expired], NOW).get("TRADE_LICENSE");
    expect(result?.governing).toBe(expired);
    expect(result?.renewal).toBeNull();
  });

  it("ignores a PENDING_REVIEW row older than the governing approval", () => {
    const stalePending = row({ status: "PENDING_REVIEW", uploadedAt: day(-60) });
    const approved = row({ status: "APPROVED", uploadedAt: day(-30), expiryDate: FUTURE });
    const result = selectGoverningDocuments([stalePending, approved], NOW).get("TRADE_LICENSE");
    expect(result?.governing).toBe(approved);
    expect(result?.renewal).toBeNull();
  });

  it("reports the newest renewal when more than one is newer than the approval", () => {
    const approved = row({ status: "APPROVED", uploadedAt: day(-30), expiryDate: FUTURE });
    const earlierRenewal = row({ status: "PENDING_REVIEW", uploadedAt: day(-3) });
    const latestRenewal = row({ status: "PENDING_REVIEW", uploadedAt: day(-1) });
    const result = selectGoverningDocuments([approved, earlierRenewal, latestRenewal], NOW).get("TRADE_LICENSE");
    expect(result?.governing).toBe(approved);
    expect(result?.renewal).toBe(latestRenewal);
  });

  it("is independent of input order", () => {
    const approved = row({ status: "APPROVED", uploadedAt: day(-30), expiryDate: FUTURE });
    const renewal = row({ status: "PENDING_REVIEW", uploadedAt: day(-1) });
    const rejectedOld = row({ status: "REJECTED", uploadedAt: day(-90) });
    const newestFirst = selectGoverningDocuments([renewal, approved, rejectedOld], NOW).get("TRADE_LICENSE");
    const oldestFirst = selectGoverningDocuments([rejectedOld, approved, renewal], NOW).get("TRADE_LICENSE");
    expect(newestFirst?.governing).toBe(approved);
    expect(newestFirst?.renewal).toBe(renewal);
    expect(oldestFirst?.governing).toBe(approved);
    expect(oldestFirst?.renewal).toBe(renewal);
  });

  it("keeps document types independent of one another", () => {
    const crApproved = row({ type: "COMMERCIAL_REGISTRATION", status: "APPROVED", uploadedAt: day(-40), expiryDate: FUTURE });
    const crRenewal = row({ type: "COMMERCIAL_REGISTRATION", status: "PENDING_REVIEW", uploadedAt: day(-2) });
    const vatPending = row({ type: "VAT_CERTIFICATE", status: "PENDING_REVIEW", uploadedAt: day(-1) });
    const result = selectGoverningDocuments([crApproved, crRenewal, vatPending], NOW);
    expect(result.size).toBe(2);
    expect(result.get("COMMERCIAL_REGISTRATION")?.governing).toBe(crApproved);
    expect(result.get("COMMERCIAL_REGISTRATION")?.renewal).toBe(crRenewal);
    expect(result.get("VAT_CERTIFICATE")?.governing).toBe(vatPending);
    expect(result.get("VAT_CERTIFICATE")?.renewal).toBeNull();
    expect(result.has("TRADE_LICENSE")).toBe(false);
  });

  it("judges expiry against the clock it is handed, not the wall clock", () => {
    const approved = row({ status: "APPROVED", uploadedAt: day(-30), expiryDate: FUTURE });
    const renewal = row({ status: "PENDING_REVIEW", uploadedAt: day(-1) });
    const afterExpiry = new Date(FUTURE.getTime() + 1);
    const result = selectGoverningDocuments([approved, renewal], afterExpiry).get("TRADE_LICENSE");
    expect(result?.governing).toBe(renewal);
    expect(result?.renewal).toBeNull();
  });

  it("does not mutate the rows it is given", () => {
    const rows = [
      row({ status: "PENDING_REVIEW", uploadedAt: day(-1) }),
      row({ status: "APPROVED", uploadedAt: day(-30), expiryDate: FUTURE }),
    ];
    const snapshot = rows.map((r) => ({ ...r }));
    selectGoverningDocuments(rows, NOW);
    expect(rows).toEqual(snapshot);
  });
});
