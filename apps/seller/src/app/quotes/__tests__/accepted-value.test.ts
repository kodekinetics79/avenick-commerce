import { describe, expect, it } from "vitest";
import { groupAcceptedValueByCurrency } from "../accepted-value";

describe("groupAcceptedValueByCurrency", () => {
  it("keeps each currency's total separate instead of summing across them", () => {
    const totals = groupAcceptedValueByCurrency([
      { currency: "AED", totalQuoted: "1000.00" },
      { currency: "SAR", totalQuoted: 4000 },
      { currency: "AED", totalQuoted: 250.5 },
    ]);
    expect(totals).toEqual([
      { currency: "SAR", total: 4000 },
      { currency: "AED", total: 1250.5 },
    ]);
  });

  it("returns a single figure when every quote shares one currency", () => {
    expect(groupAcceptedValueByCurrency([
      { currency: "QAR", totalQuoted: 10 },
      { currency: "QAR", totalQuoted: 5 },
    ])).toEqual([{ currency: "QAR", total: 15 }]);
  });

  it("returns nothing when there is nothing accepted", () => {
    expect(groupAcceptedValueByCurrency([])).toEqual([]);
  });

  it("omits an accepted quote that was never priced rather than inventing a zero group", () => {
    // An ACCEPTED RFQ with no totalQuoted is a data gap; a "KWD 0" tile would
    // read as a deal worth nothing rather than a total nobody recorded.
    expect(groupAcceptedValueByCurrency([{ currency: "KWD", totalQuoted: null }])).toEqual([]);
    expect(groupAcceptedValueByCurrency([{ currency: "KWD", totalQuoted: "not-a-number" }])).toEqual([]);
  });

  it("orders by size so the seller's main market leads, ties by code", () => {
    const totals = groupAcceptedValueByCurrency([
      { currency: "OMR", totalQuoted: 100 },
      { currency: "BHD", totalQuoted: 100 },
      { currency: "USD", totalQuoted: 900 },
    ]);
    expect(totals.map((t) => t.currency)).toEqual(["USD", "BHD", "OMR"]);
  });
});
