import { describe, expect, it } from "vitest";

import {
  SESSION_ISSUED_AT_CLAIM,
  isSessionRevoked,
  sessionIssuedAtSeconds,
} from "../session-revocation";

/**
 * The comparison that turns `User.sessionsValidAfter` from a column into a
 * revocation. Three rules, and two of them are the ones a reader gets backwards.
 */

const AT = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);

describe("sessionIssuedAtSeconds", () => {
  it("reads the claim off a session object", () => {
    expect(sessionIssuedAtSeconds({ [SESSION_ISSUED_AT_CLAIM]: 1_770_000_000 })).toBe(1_770_000_000);
  });

  it("floors a fractional value so the comparison is always whole seconds", () => {
    expect(sessionIssuedAtSeconds({ [SESSION_ISSUED_AT_CLAIM]: 1_770_000_000.9 })).toBe(1_770_000_000);
  });

  it.each([
    ["a session that predates the claim", {}],
    ["a string", { [SESSION_ISSUED_AT_CLAIM]: "1770000000" }],
    ["NaN", { [SESSION_ISSUED_AT_CLAIM]: Number.NaN }],
    ["zero", { [SESSION_ISSUED_AT_CLAIM]: 0 }],
    ["a negative instant", { [SESSION_ISSUED_AT_CLAIM]: -1 }],
    ["null", null],
    ["a string carrier", "nope"],
  ])("returns null for %s", (_label, carrier) => {
    expect(sessionIssuedAtSeconds(carrier)).toBeNull();
  });
});

describe("isSessionRevoked", () => {
  it("ALLOWS everything when no cutoff has ever been set", () => {
    // The column exists to revoke on demand. Reading NULL as "revoke" would
    // have signed the entire userbase out the day the migration landed.
    expect(isSessionRevoked(AT("2020-01-01T00:00:00Z"), null)).toBe(false);
    expect(isSessionRevoked(null, null)).toBe(false);
    expect(isSessionRevoked(null, undefined)).toBe(false);
  });

  it("REFUSES a session issued before the cutoff — the stolen cookie", () => {
    expect(
      isSessionRevoked(AT("2026-09-01T10:00:00Z"), new Date("2026-09-02T10:00:00Z")),
    ).toBe(true);
  });

  it("allows a session issued after the cutoff — the owner's new sign-in", () => {
    expect(
      isSessionRevoked(AT("2026-09-03T10:00:00Z"), new Date("2026-09-02T10:00:00Z")),
    ).toBe(false);
  });

  it("REFUSES a session it cannot date, once a cutoff exists", () => {
    // A cookie minted before the claim shipped is exactly the cookie a reset is
    // trying to kill. "I cannot date it" must not read as "it is fine".
    expect(isSessionRevoked(null, new Date("2026-09-02T10:00:00Z"))).toBe(true);
  });

  it("resolves a same-second tie against the session, not in its favour", () => {
    // The issued-at is whole seconds and the cutoff has millisecond precision.
    // Rounding the other way would let the very session being revoked survive.
    const cutoff = new Date("2026-09-02T10:00:00.500Z");
    expect(isSessionRevoked(AT("2026-09-02T10:00:00Z"), cutoff)).toBe(true);
    expect(isSessionRevoked(AT("2026-09-02T10:00:01Z"), cutoff)).toBe(false);
  });

  it("accepts an ISO string cutoff, as a JSON round trip produces", () => {
    expect(isSessionRevoked(AT("2026-09-01T00:00:00Z"), "2026-09-02T10:00:00.000Z")).toBe(true);
  });

  it("does not revoke on an unparseable cutoff", () => {
    // A corrupt row is a bug, not a revocation; refusing every request on the
    // account would be a self-inflicted outage.
    expect(isSessionRevoked(AT("2026-09-01T00:00:00Z"), "not a date")).toBe(false);
  });
});
