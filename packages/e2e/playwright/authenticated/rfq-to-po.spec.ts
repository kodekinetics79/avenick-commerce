import { expect, test, type Browser, type BrowserContext, type Locator, type Page, type TestInfo } from "@playwright/test";
import { PERSONAS, PERSONA_SET, storageStatePath } from "../../personas.mjs";
import { isLocalTarget, url } from "../../targets.mjs";

const SELLER_A = "Gulf Industrial Supplies LLC";
const SELLER_B = "Emirates Marketplace Tools LLC";

type DealLedger = {
  id: string;
  status: string;
  acceptedQuoteId: string | null;
  quotes: Array<{
    id: string;
    status: string;
    seller: { businessNameEn: string };
    purchaseOrder: { id: string; poNumber: string; status: string } | null;
  }>;
};

function dateFromNow(days: number) {
  const value = new Date();
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

async function evidence(page: Page, testInfo: TestInfo, name: string) {
  await testInfo.attach(name, {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });
}

async function authenticatedContext(browser: Browser, persona: keyof typeof PERSONAS) {
  return browser.newContext({
    storageState: storageStatePath(persona),
    viewport: { width: 1440, height: 1000 },
  });
}

async function assertInvitation(context: BrowserContext, rfqId: string, expectedSeller: string) {
  const response = await context.request.get(url("seller", "/api/seller/rfqs"));
  expect(response.status(), `${expectedSeller} could not read its RFQ inbox`).toBe(200);
  const body = await response.json();
  expect(body.data.seller.businessNameEn).toBe(expectedSeller);
  expect(
    body.data.inbox.map((row: { rfq: { id: string } }) => row.rfq.id),
    `${expectedSeller} was not invited to the RFQ created through the buyer UI`,
  ).toContain(rfqId);
}

async function selectFirstOption(page: Page, trigger: Locator) {
  await trigger.click();
  await page.getByRole("option").first().click();
}

async function submitSellerQuote(page: Page, rfqId: string, unitPrice: string, freight: string, testInfo: TestInfo, evidenceName: string) {
  await page.goto(url("seller", `/quotes/submit?rfq=${encodeURIComponent(rfqId)}`), { waitUntil: "domcontentloaded" });

  const form = page.locator("form").filter({ has: page.locator('[id^="product-"]') });
  await expect(form).toHaveCount(1);
  await selectFirstOption(page, form.locator('[id^="product-"]').first());

  const variant = form.locator('[id^="variant-"]').first();
  if (await variant.count()) await selectFirstOption(page, variant);

  await form.locator('[id^="price-"]').first().fill(unitPrice);
  await form.locator('[id^="vat-"]').first().fill("5");
  await form.locator("#quote-freight").fill(freight);
  await form.locator("#quote-freight-vat").fill("5");
  await form.locator("#quote-lead-time").fill("10");
  await form.locator("#quote-payment-terms").fill("30");
  await form.locator("button[type=submit]").click();

  await page.waitForURL((current) => current.pathname === "/quotes/submit" && current.searchParams.get("submitted") === "1");
  await expect(page.getByRole("status")).toBeVisible();
  await evidence(page, testInfo, evidenceName);
}

test.describe("RFQ to purchase order certification", () => {
  test.describe.configure({ mode: "serial" });

  test("company buyer awards one of two isolated supplier quotes and receives exactly one draft PO", async ({ browser }, testInfo) => {
    test.setTimeout(180_000);
    expect(
      process.env.E2E_ALLOW_CERTIFICATION_WRITES,
      "Refusing a commercial write journey without E2E_ALLOW_CERTIFICATION_WRITES=1",
    ).toBe("1");
    expect(PERSONA_SET, "RFQ certification requires the disposable seed persona set").toBe("seed");
    expect(
      (["customer", "seller", "admin"] as const).every((portal) => isLocalTarget(portal)),
      "RFQ certification writes are restricted to disposable loopback environments",
    ).toBe(true);
    expect(PERSONAS.companyAdmin, "Seed company-admin persona is missing").toBeTruthy();
    expect(PERSONAS.sellerOwner, "Seed Seller A persona is missing").toBeTruthy();
    expect(PERSONAS.sellerBOwner, "Seed Seller B persona is missing").toBeTruthy();

    let buyer: BrowserContext | undefined;
    let sellerA: BrowserContext | undefined;
    let sellerB: BrowserContext | undefined;

    try {
      buyer = await authenticatedContext(browser, "companyAdmin");
      sellerA = await authenticatedContext(browser, "sellerOwner");
      sellerB = await authenticatedContext(browser, "sellerBOwner");

      const buyerPage = await buyer.newPage();
      await buyerPage.goto(url("customer", "/b2b/rfq/new"), { waitUntil: "domcontentloaded" });
      const form = buyerPage.locator("form").filter({ has: buyerPage.locator("#rfq-title") });

      await form.locator("#rfq-title").fill("RFQ browser certification — two supplier safety tools");
      await form.locator("#rfq-category").selectOption({ index: 1 });
      await form.locator("#rfq-response-due").fill(dateFromNow(7));
      await form.locator("#rfq-award-by").fill(dateFromNow(14));
      await form.locator("#rfq-required-by").fill(dateFromNow(30));
      await form.locator("#rfq-city").fill("Abu Dhabi");
      await form.locator('[id^="item-"][id$="-description"]').fill("Industrial safety tool kit");
      await form.locator('[id^="item-"][id$="-quantity"]').fill("12");

      const supplierSearch = form.locator('input[aria-label]').first();
      await supplierSearch.fill("Gulf Industrial");
      const sellerAResult = form.getByRole("button", { name: new RegExp(SELLER_A) });
      await expect(sellerAResult).toBeVisible();
      await sellerAResult.click();

      await supplierSearch.fill("Emirates Marketplace");
      const sellerBResult = form.getByRole("button", { name: new RegExp(SELLER_B) });
      await expect(sellerBResult).toBeVisible();
      await sellerBResult.click();

      // Force the selected-supplier state to render before submitting. The
      // search result and selected card deliberately use the same company
      // label, so clear the results and prove that both selected cards remain.
      await supplierSearch.fill("");
      await expect(form.getByText(SELLER_A, { exact: true })).toHaveCount(1);
      await expect(form.getByText(SELLER_B, { exact: true })).toHaveCount(1);

      await form.locator("button[type=submit]").last().click();
      await buyerPage.waitForURL((current) => {
        const match = current.pathname.match(/^\/b2b\/rfq\/([A-Za-z0-9_-]+)$/);
        return Boolean(match?.[1] && match[1] !== "new");
      });
      const rfqId = new URL(buyerPage.url()).pathname.split("/").pop();
      expect(rfqId, "RFQ creation did not produce a record id").toBeTruthy();
      await evidence(buyerPage, testInfo, "rfq-created-and-two-suppliers-invited.png");

      await assertInvitation(sellerA, rfqId!, SELLER_A);
      await assertInvitation(sellerB, rfqId!, SELLER_B);

      const sellerAPage = await sellerA.newPage();
      await submitSellerQuote(sellerAPage, rfqId!, "125", "40", testInfo, "seller-a-quote-submitted.png");
      await submitSellerQuote(sellerAPage, rfqId!, "120", "35", testInfo, "seller-a-revision-two-submitted.png");

      // Seller B is legitimately invited to the same RFQ, but must not receive
      // Seller A's commercial submission in its seller-scoped projection.
      const sellerBBefore = await sellerB.request.get(url("seller", `/api/seller/rfqs/${encodeURIComponent(rfqId!)}`));
      expect(sellerBBefore.status()).toBe(200);
      const sellerBBeforeBody = await sellerBBefore.json();
      expect(sellerBBeforeBody.data.invitation.quotes).toEqual([]);

      const sellerBPage = await sellerB.newPage();
      await submitSellerQuote(sellerBPage, rfqId!, "110", "25", testInfo, "seller-b-quote-submitted.png");

      await buyerPage.goto(url("customer", `/b2b/rfq/${encodeURIComponent(rfqId!)}`), { waitUntil: "domcontentloaded" });
      const beforeAward = await buyer.request.get(url("customer", `/api/b2b/rfqs/${encodeURIComponent(rfqId!)}`));
      expect(beforeAward.status()).toBe(200);
      const beforeAwardLedger = (await beforeAward.json()).data as DealLedger;
      expect(beforeAwardLedger.quotes).toHaveLength(2);
      expect(beforeAwardLedger.quotes.map((quote) => quote.seller.businessNameEn).sort()).toEqual([SELLER_A, SELLER_B].sort());
      await evidence(buyerPage, testInfo, "buyer-deal-ledger-two-quotes.png");

      const sellerBCard = buyerPage
        .getByRole("heading", { name: SELLER_B })
        .locator("xpath=ancestor::*[@data-rung][1]");
      await sellerBCard.locator("button").click();
      const dialog = buyerPage.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await dialog.locator("button[type=submit]").click();

      await buyerPage.waitForURL((current) => current.pathname === `/b2b/rfq/${rfqId}` && current.searchParams.get("award") === "done");
      const receipt = buyerPage.getByRole("status");
      await expect(receipt).toBeVisible();
      await evidence(buyerPage, testInfo, "buyer-award-receipt.png");

      const ledgerResponse = await buyer.request.get(url("customer", `/api/b2b/rfqs/${encodeURIComponent(rfqId!)}`));
      expect(ledgerResponse.status()).toBe(200);
      const ledger = (await ledgerResponse.json()).data as DealLedger;
      expect(ledger.status).toBe("ACCEPTED");
      expect(ledger.quotes).toHaveLength(2);
      const accepted = ledger.quotes.filter((quote) => quote.status === "ACCEPTED");
      const linked = ledger.quotes.filter((quote) => quote.purchaseOrder !== null);
      expect(accepted).toHaveLength(1);
      expect(accepted[0]!.seller.businessNameEn).toBe(SELLER_B);
      expect(linked).toHaveLength(1);
      expect(linked[0]!.id).toBe(ledger.acceptedQuoteId);
      expect(linked[0]!.purchaseOrder!.status).toBe("DRAFT");

      const poResponse = await buyer.request.get(url("customer", "/api/b2b/purchase-orders"));
      expect(poResponse.status()).toBe(200);
      const poBody = await poResponse.json();
      const matchingPurchaseOrders = poBody.data.purchaseOrders.filter(
        (po: { id: string }) => po.id === linked[0]!.purchaseOrder!.id,
      );
      expect(matchingPurchaseOrders).toHaveLength(1);
      expect(matchingPurchaseOrders[0].status).toBe("DRAFT");

      await testInfo.attach("rfq-to-po-persistence.json", {
        body: JSON.stringify({
          rfqId: ledger.id,
          rfqStatus: ledger.status,
          quoteCount: ledger.quotes.length,
          acceptedQuoteId: ledger.acceptedQuoteId,
          purchaseOrder: linked[0]!.purchaseOrder,
          matchingPurchaseOrderCount: matchingPurchaseOrders.length,
        }, null, 2),
        contentType: "application/json",
      });

      await buyerPage.goto(url("customer", "/b2b/purchase-orders"), { waitUntil: "domcontentloaded" });
      await expect(buyerPage.getByText(linked[0]!.purchaseOrder!.poNumber, { exact: true })).toHaveCount(1);
      await evidence(buyerPage, testInfo, "buyer-draft-po-ledger.png");
    } finally {
      await Promise.all([buyer?.close(), sellerA?.close(), sellerB?.close()]);
    }
  });
});
