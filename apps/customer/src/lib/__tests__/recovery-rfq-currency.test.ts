import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ context: vi.fn(), create: vi.fn() }));
vi.mock("@/lib/b2b-server", () => ({ getServerB2BContext: mocks.context }));
vi.mock("@avenick/database", () => ({ createRFQ: mocks.create }));

import { POST } from "../../app/api/b2b/rfqs/route";

const payload = {
  notes: "Subject: Pumps · Delivery: Riyadh · Keep original requirements",
  items: [{ nameEn: "Industrial pump", quantity: 2, notes: "Target price" }],
};
const post = (body: unknown) => POST(new Request("http://localhost/api/b2b/rfqs", {
  method: "POST", body: JSON.stringify(body),
}));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.create.mockResolvedValue({ id: "created-rfq" });
});

describe("RFQ creation currency authority", () => {
  it.each([["SA", "SAR"], ["KW", "KWD"], ["AE", "AED"]])(
    "uses the authenticated %s company's %s currency, including forged payloads",
    async (country, currency) => {
      mocks.context.mockResolvedValue({ userId: "member", companyId: "company", company: { country } });
      for (const extra of [{}, {
        currency: currency === "AED" ? "SAR" : "AED",
        buyerId: "attacker", companyId: "foreign-company", country: "US",
        company: { country: "US" },
      }]) {
        const response = await post({ ...payload, ...extra });
        expect(response.status).toBe(201);
        expect(await response.json()).toEqual({ success: true, data: { id: "created-rfq" } });
        expect(mocks.create).toHaveBeenLastCalledWith({
          ...payload, buyerId: "member", companyId: "company", currency, requiredBy: undefined,
        });
      }
      expect(mocks.create).toHaveBeenCalledTimes(2);
    },
  );

  it("refuses creation without authenticated company membership even with forged context", async () => {
    mocks.context.mockResolvedValue(null);
    const response = await post({ ...payload, companyId: "company", currency: "SAR", country: "SA" });
    expect(response.status).toBe(401);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("still rejects invalid request items before creating anything", async () => {
    mocks.context.mockResolvedValue({ userId: "member", companyId: "company", company: { country: "KW" } });
    expect((await post({ ...payload, items: [] })).status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
