import { describe, expect, it } from "vitest";
import { isDurableAdmin } from "../admin-access";

describe("durable admin authorization", () => {
  it("rejects suspended, deleted, and demoted JWT holders", () => {
    expect(isDurableAdmin({ role: "SUPER_ADMIN", status: "SUSPENDED", deletedAt: null })).toBe(false);
    expect(isDurableAdmin({ role: "ADMIN", status: "ACTIVE", deletedAt: new Date() })).toBe(false);
    expect(isDurableAdmin({ role: "CONSUMER", status: "ACTIVE", deletedAt: null })).toBe(false);
  });

  it("accepts only current active administrators", () => {
    expect(isDurableAdmin({ role: "ADMIN", status: "ACTIVE", deletedAt: null })).toBe(true);
  });
});
