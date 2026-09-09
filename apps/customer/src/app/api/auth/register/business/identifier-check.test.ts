import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  findUnique: vi.fn(),
  findFirst: vi.fn(),
  transaction: vi.fn(),
  hash: vi.fn(),
  notice: vi.fn(),
}));

vi.mock("@avenick/auth/rate-limit", () => ({
  checkRateLimit: mocks.checkRateLimit,
  clientIpFrom: () => "127.0.0.1",
  RATE_LIMITS: { register: { name: "register", limit: 5, windowMs: 3_600_000 } },
}));
vi.mock("@avenick/database", () => ({
  db: {
    company: { findUnique: mocks.findUnique },
    user: { findUnique: mocks.findFirst },
    $transaction: mocks.transaction,
  },
}));
vi.mock("bcryptjs", () => ({ default: { hash: mocks.hash }, hash: mocks.hash }));
vi.mock("@/lib/email", () => ({ sendAlreadyRegisteredNotice: mocks.notice }));
vi.mock("@avenick/observability", () => ({ log: { info: () => {}, warn: () => {}, error: () => {} } }));

import { POST } from "./route";

const base = {
  companyNameEn: "Test Trading",
  crNumber: "1010123456",
  industry: "OTHER",
  companySize: "SMALL",
  country: "SA",
  city: "Riyadh",
  firstName: "Test",
  lastName: "Person",
  email: "someone@example.test",
  password: "Password1",
  language: "EN",
};

const post = (body: Record<string, unknown>) =>
  POST(new NextRequest("http://localhost/api/auth/register/business", { method: "POST", body: JSON.stringify(body) }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.checkRateLimit.mockResolvedValue({ ok: true, resetAt: Date.now() + 1000 });
  mocks.findUnique.mockResolvedValue(null);
  mocks.findFirst.mockResolvedValue(null);
  mocks.hash.mockResolvedValue("hashed");
  mocks.transaction.mockResolvedValue({ user: { id: "u" }, company: { id: "c", status: "PENDING_VERIFICATION" } });
});

/**
 * The schema can only say "5 to 30 characters" for a CR number, because it does
 * not know the issuing country until the same payload is parsed. These cases
 * pin the country-aware half — and, above all, that it refuses almost nothing:
 * turning away a real company at registration is the most expensive mistake
 * this route can make.
 */
describe("registry identifiers are checked against the country that issued them", () => {
  it("refuses a 14-digit Saudi VAT number and says it must be 15", async () => {
    const response = await post({ ...base, vatNumber: "30012345670003" });
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(/15/);
    expect(body.fieldErrors?.vatNumber).toBeTruthy();
    // The exact defect in the reference: a message that names an internal field.
    expect(JSON.stringify(body)).not.toMatch(/vatValidFrom|crNumber":\s*"crNumber/);
  });

  it("accepts the 15-digit Saudi VAT number the same applicant should have typed", async () => {
    const response = await post({ ...base, vatNumber: "300123456700003" });
    expect(response.status).toBe(200);
  });

  it("accepts a Kuwaiti company with no VAT number at all", async () => {
    const response = await post({ ...base, country: "KW", crNumber: "123456", vatNumber: undefined });
    expect(response.status).toBe(200);
  });

  it("accepts an Omani VAT identifier that is not digits only", async () => {
    const response = await post({ ...base, country: "OM", crNumber: "1234567", vatNumber: "OM1100000000" });
    expect(response.status).toBe(200);
  });

  it("accepts a newly issued Saudi CR that no legacy city prefix would allow", async () => {
    // The 1010/2050/4030 prefixes stopped being universal in 2025.
    const response = await post({ ...base, crNumber: "7001234567" });
    expect(response.status).toBe(200);
  });

  it("still lets the duplicate-CR check answer truthfully", async () => {
    mocks.findUnique.mockResolvedValue({ id: "existing" });
    const response = await post({ ...base });
    expect(response.status).toBe(409);
  });
});
