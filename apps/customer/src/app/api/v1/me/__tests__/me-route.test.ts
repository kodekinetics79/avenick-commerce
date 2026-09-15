import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ErrorEnvelopeSchema, MeResponseSchema } from "@avenick/contracts";

/**
 * GET /api/v1/me — the one call every screen waits on, which is why the two
 * decisions below matter more than they look.
 */
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findUniqueUser: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("@/lib/auth-instance", () => ({ auth: mocks.auth }));
vi.mock("@avenick/auth/rate-limit", () => ({
  checkRateLimit: async () => ({ ok: true, count: 1, limit: 120, resetAt: Date.now() + 60_000 }),
  clientIpFrom: () => "203.0.113.7",
}));
vi.mock("@avenick/observability", () => {
  const log = { error: mocks.logError, info: vi.fn(), warn: mocks.logWarn, debug: vi.fn(), with: () => log };
  return { log, instrumentRequest: () => ({ ctx: { log }, finish: vi.fn() }) };
});
vi.mock("@avenick/database", () => ({ db: { user: { findUnique: mocks.findUniqueUser } } }));

import { GET } from "../route";

const PRINCIPAL_ROW = { role: "CONSUMER", status: "ACTIVE", deletedAt: null, companyMember: null };

const PROFILE_ROW = {
  id: "usr_1",
  email: "buyer@example.com",
  phone: "+971501234567",
  firstName: "Layla",
  lastName: "Haddad",
  firstNameAr: null,
  lastNameAr: null,
  avatar: null,
  role: "CONSUMER",
  status: "ACTIVE",
  language: "EN",
  emailVerified: new Date("2026-01-01T00:00:00.000Z"),
  phoneVerified: null,
  createdAt: new Date("2025-12-01T00:00:00.000Z"),
  companyMember: null,
};

function get() {
  return new NextRequest("https://customer.test/api/v1/me", { method: "GET" });
}

async function errorOf(response: Response) {
  return ErrorEnvelopeSchema.parse(await response.json()).error;
}

/** The principal read comes first, the profile read second. */
function signedIn(profile: Record<string, unknown> = PROFILE_ROW) {
  mocks.auth.mockResolvedValue({ user: { id: "usr_1" } });
  mocks.findUniqueUser.mockResolvedValueOnce(PRINCIPAL_ROW).mockResolvedValueOnce(profile);
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue(null);
});

describe("who /v1/me answers", () => {
  it("refuses a guest", async () => {
    const response = await GET(get());
    expect(response.status).toBe(401);
    expect((await errorOf(response)).code).toBe("unauthenticated");
  });

  it("answers the signed-in identity, conforming to the contract", async () => {
    signedIn();
    const response = await GET(get());
    expect(response.status).toBe(200);
    const { data } = MeResponseSchema.parse(await response.json());
    expect(data).toEqual({
      id: "usr_1",
      email: "buyer@example.com",
      phone: "+971501234567",
      firstName: "Layla",
      lastName: "Haddad",
      firstNameAr: null,
      lastNameAr: null,
      avatar: null,
      role: "CONSUMER",
      status: "ACTIVE",
      language: "EN",
      // Booleans, not the DateTime? columns behind them.
      emailVerified: true,
      phoneVerified: false,
      company: null,
      createdAt: "2025-12-01T00:00:00.000Z",
    });
  });

  it("reads the profile by the PRINCIPAL's id, never one from the request", async () => {
    signedIn();
    await GET(get());
    expect(mocks.findUniqueUser.mock.calls[1]![0].where).toEqual({ id: "usr_1" });
  });
});

describe("the company half of an identity", () => {
  const membership = (companyStatus: string, isActive = true, deletedAt: Date | null = null) => ({
    ...PROFILE_ROW,
    companyMember: {
      companyId: "comp_1",
      role: "COMPANY_BUYER",
      isActive,
      company: { nameEn: "Aramco Supplies", nameAr: null, country: "SA", status: companyStatus, deletedAt },
    },
  });

  it("reports a company that is still being verified, rather than reporting none", async () => {
    // "Your company is still being verified" and "you have no company" are
    // different screens; collapsing them to null would make them the same one.
    signedIn(membership("PENDING_VERIFICATION"));
    const { data } = MeResponseSchema.parse(await (await GET(get())).json());
    expect(data.company).toEqual({
      companyId: "comp_1",
      nameEn: "Aramco Supplies",
      nameAr: null,
      country: "SA",
      status: "PENDING_VERIFICATION",
      role: "COMPANY_BUYER",
    });
  });

  it("reports no company for a deactivated membership", async () => {
    signedIn(membership("ACTIVE", false));
    const { data } = MeResponseSchema.parse(await (await GET(get())).json());
    expect(data.company).toBeNull();
  });

  it("reports no company for a soft-deleted one", async () => {
    signedIn(membership("ACTIVE", true, new Date("2026-02-01T00:00:00.000Z")));
    const { data } = MeResponseSchema.parse(await (await GET(get())).json());
    expect(data.company).toBeNull();
  });
});

describe("a stored phone the contract cannot carry", () => {
  it("is reported as absent, and said so in the log, rather than 500ing the app", async () => {
    // PhoneSchema is `^\\+[1-9]\\d{7,14}$`. A row predating that rule would
    // otherwise fail response validation — and there is no screen that does not
    // need this call.
    signedIn({ ...PROFILE_ROW, phone: "0501234567" });
    const response = await GET(get());
    expect(response.status).toBe(200);
    const { data } = MeResponseSchema.parse(await response.json());
    expect(data.phone).toBeNull();
    expect(mocks.logWarn).toHaveBeenCalledWith(
      expect.stringContaining("stored phone"),
      expect.objectContaining({ userId: "usr_1" }),
    );
  });

  it("says nothing when there is genuinely no phone", async () => {
    signedIn({ ...PROFILE_ROW, phone: null });
    const { data } = MeResponseSchema.parse(await (await GET(get())).json());
    expect(data.phone).toBeNull();
    expect(mocks.logWarn).not.toHaveBeenCalled();
  });
});
