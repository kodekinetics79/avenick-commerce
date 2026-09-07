import { test, expect } from "@playwright/test";
import { url } from "../../targets.mjs";
import { PERSONAS, storageStatePath } from "../../personas.mjs";

/**
 * The shared database holds no Seller B account with a known password, so
 * the `shared` persona set (E2E_PERSONA_SET) has no `sellerBOwner` and no
 * state file is ever written for one. Skip with the reason rather than fail on
 * a missing file: "not exercised" is the truthful result, and it is visible in
 * the report as exactly that.
 */
const NO_SELLER_B = "No Seller B persona in the active persona set (E2E_PERSONA_SET) — seller-to-seller isolation not exercised";

/**
 * Seller-to-seller isolation.
 *
 * Anonymous denial proves very little. The question that matters for a
 * marketplace is whether one legitimately authenticated seller can reach
 * another seller's commercial data. These tests read real IDs as Seller A and
 * then attempt them as Seller B.
 */

test.describe("seller-to-seller isolation", () => {
  test("Seller B sees only its own line items on a shared order", async ({ browser }) => {
    test.skip(!PERSONAS.sellerBOwner, NO_SELLER_B);
    // A marketplace order can legitimately contain items from several sellers,
    // so both sellers seeing the same order header is CORRECT, not a leak. The
    // real isolation guarantee is at line-item level: each seller must receive
    // only the lines it owns.
    const sellerB = await browser.newContext({ storageState: storageStatePath("sellerBOwner") });

    try {
      const meResponse = await sellerB.request.get(url("seller", "/api/seller/dashboard"));
      expect(meResponse.status(), "Seller B could not read its own dashboard").toBe(200);

      const response = await sellerB.request.get(url("seller", "/api/seller/orders"));
      expect(response.status(), "Seller B could not read its own orders").toBe(200);

      const body = await response.json();
      const orders = body.data ?? body.orders ?? body;
      const list = Array.isArray(orders) ? orders : [];

      test.skip(list.length === 0, "Seller B has no seeded orders — isolation not exercised");

      const ownSellerIds = new Set<string>();
      for (const order of list) {
        for (const item of order.items ?? []) {
          if (item.sellerId) ownSellerIds.add(item.sellerId);
        }
      }

      // Every line item across every order must belong to exactly one seller:
      // the one asking. More than one distinct sellerId means another seller's
      // commercial lines are being disclosed.
      expect(
        [...ownSellerIds],
        `Seller B received line items belonging to more than one seller: ${[...ownSellerIds].join(", ")}`,
      ).toHaveLength(1);
    } finally {
      await sellerB.close();
    }
  });

  test("a shared order discloses no foreign line items to either seller", async ({ browser }) => {
    test.skip(!PERSONAS.sellerBOwner, NO_SELLER_B);
    const sellerA = await browser.newContext({ storageState: storageStatePath("sellerOwner") });
    const sellerB = await browser.newContext({ storageState: storageStatePath("sellerBOwner") });

    try {
      const sellerIdsFrom = async (ctx: typeof sellerA) => {
        const r = await ctx.request.get(url("seller", "/api/seller/orders"));
        expect(r.status()).toBe(200);
        const body = await r.json();
        const list = body.data ?? body.orders ?? body;
        const ids = new Set<string>();
        for (const order of Array.isArray(list) ? list : []) {
          for (const item of order.items ?? []) if (item.sellerId) ids.add(item.sellerId);
        }
        return ids;
      };

      const aSellerIds = await sellerIdsFrom(sellerA);
      const bSellerIds = await sellerIdsFrom(sellerB);

      test.skip(aSellerIds.size === 0 || bSellerIds.size === 0, "Not enough seeded orders to exercise");

      // The two sellers' line-item ownership sets must be disjoint even where
      // they share an order header.
      const overlap = [...aSellerIds].filter((id) => bSellerIds.has(id));
      expect(overlap, `Both sellers received line items for seller(s): ${overlap.join(", ")}`).toEqual([]);
    } finally {
      await sellerA.close();
      await sellerB.close();
    }
  });

  test("Seller B cannot fetch a Seller A record by direct ID", async ({ browser }) => {
    test.skip(!PERSONAS.sellerBOwner, NO_SELLER_B);
    // This test is written to be NON-VACUOUS. An earlier version targeted
    // /api/seller/orders/:id, which does not exist — so it returned 404 to
    // everyone and passed while asserting nothing. It would have passed
    // identically if isolation were completely broken.
    //
    // The guard: first prove the endpoint is real by fetching as its OWNER and
    // requiring 200. Only then does a non-200 for the other seller mean
    // anything. If the route ever disappears, this fails loudly instead of
    // going quietly green.
    const sellerA = await browser.newContext({ storageState: storageStatePath("sellerOwner") });
    const sellerB = await browser.newContext({ storageState: storageStatePath("sellerBOwner") });

    try {
      const listResponse = await sellerA.request.get(url("seller", "/api/seller/rfqs"));
      expect(listResponse.status(), "Seller A could not list its own RFQs").toBe(200);

      const listBody = await listResponse.json();
      const rfqs = listBody.data ?? listBody.rfqs ?? listBody;
      const target = (Array.isArray(rfqs) ? rfqs : [])[0];

      test.skip(!target?.id, "No RFQ available to attempt — isolation not exercised");

      // Step 1 — prove the endpoint exists and serves its owner.
      const ownerResponse = await sellerA.request.get(url("seller", `/api/seller/rfqs/${target.id}`));
      expect(
        ownerResponse.status(),
        `Owner could not read its own record, so a denial for the other seller would prove nothing. ` +
          `Got HTTP ${ownerResponse.status()} — has the route moved?`,
      ).toBe(200);

      // Step 2 — only now is a denial meaningful.
      const intruderResponse = await sellerB.request.get(url("seller", `/api/seller/rfqs/${target.id}`));
      expect(
        intruderResponse.status(),
        `Seller B received HTTP ${intruderResponse.status()} for Seller A's RFQ ${target.id}`,
      ).not.toBe(200);
    } finally {
      await sellerA.close();
      await sellerB.close();
    }
  });
});

test.describe("buyer account isolation", () => {
  test("a buyer's order list contains only their own orders", async ({ browser }) => {
    const buyer = await browser.newContext({ storageState: storageStatePath("buyer") });
    const company = await browser.newContext({ storageState: storageStatePath("companyAdmin") });

    try {
      const buyerResponse = await buyer.request.get(url("customer", "/api/orders"));
      const companyResponse = await company.request.get(url("customer", "/api/orders"));

      expect(buyerResponse.status()).toBe(200);
      expect(companyResponse.status()).toBe(200);

      const idsOf = async (r: typeof buyerResponse) => {
        const body = await r.json();
        const list = body.data ?? body.orders ?? body;
        return (Array.isArray(list) ? list : []).map((o: { id: string }) => o.id).filter(Boolean);
      };

      const buyerIds = await idsOf(buyerResponse);
      const companyIds = new Set(await idsOf(companyResponse));

      test.skip(buyerIds.length === 0, "Buyer has no seeded orders — isolation not exercised");

      const leaked = buyerIds.filter((id: string) => companyIds.has(id));
      expect(leaked, `Orders visible to both accounts: ${leaked.join(", ")}`).toEqual([]);
    } finally {
      await buyer.close();
      await company.close();
    }
  });
});
