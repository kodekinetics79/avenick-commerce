import { describe, expect, it } from "vitest";
import { accountCopy, statusComponentDetail, statusComponentLabel } from "../account-copy";

/**
 * /status printed the endpoint's internal identifiers to buyers.
 *
 * Each row was `c.name.replace(/-/g, " ")` under CSS `capitalize`, beside
 * `c.detail` verbatim, so the live page read "Database Circuit — CLOSED —
 * Operational" and "Primary Journeys — no synthetic configured", and the
 * summary line said "no journey synthetic has run against this deployment".
 * Those are an ops runbook's words, not a buyer's.
 *
 * /api/status itself must not change — it is the contract uptime monitors read —
 * so the relabelling happens in the page, from these two helpers.
 */
describe("status page copy", () => {
  const names = ["api", "database", "database-circuit", "external-integrations", "primary-journeys"];

  it.each(["en", "ar"] as const)("labels every component /api/status reports, in %s", (locale) => {
    const t = accountCopy(locale).status;
    for (const name of names) {
      const label = statusComponentLabel(t.componentLabels, name);
      expect(label).not.toBe(name);
      expect(label).not.toMatch(/circuit|synthetic|-/i);
    }
  });

  it("writes the Arabic labels in Arabic", () => {
    const t = accountCopy("ar").status;
    for (const name of names) expect(statusComponentLabel(t.componentLabels, name)).toMatch(/[؀-ۿ]/);
    expect(t.noJourneySynthetic).toMatch(/[؀-ۿ]/);
  });

  it("still renders a component it has no label for, rather than dropping the row", () => {
    expect(statusComponentLabel(accountCopy("en").status.componentLabels, "search-index")).toBe("Search index");
  });

  it("prints a measured latency and withholds details the pill already states", () => {
    const t = accountCopy("en").status;
    expect(statusComponentDetail(t, "latency 42ms")).toBe("latency 42ms");
    expect(statusComponentDetail(t, "CLOSED")).toBeNull();
    expect(statusComponentDetail(t, "none configured")).toBeNull();
    expect(statusComponentDetail(t, "2 configured, health not probed")).toBeNull();
    expect(statusComponentDetail(t, "no synthetic configured")).toBeNull();
    expect(statusComponentDetail(t, undefined)).toBeNull();
  });

  it("sets the latency in the reader's language, keeping only the figure from the endpoint", () => {
    // The endpoint's detail is English. Passed through verbatim, the Arabic page
    // read "قاعدة البيانات | latency 79ms | تعمل".
    const detail = statusComponentDetail(accountCopy("ar").status, "latency 79ms");
    expect(detail).toMatch(/[؀-ۿ]/);
    expect(detail).toContain("79");
    expect(detail).not.toMatch(/latency|ms\b/i);
  });

  it("keeps the ops phrasing out of the journeys summary", () => {
    for (const locale of ["en", "ar"] as const) {
      expect(accountCopy(locale).status.noJourneySynthetic).not.toMatch(/synthetic|deployment/i);
    }
  });
});
