import { describe, expect, it } from "vitest";
import {
  BUYER_PAYMENT_METHODS,
  ORDER_FLOW,
  ORDER_STATUS_VALUES,
  flowPosition,
  parsePersistedOrder,
  reconcilePersistedTotals,
  whatHappensNext,
} from "../checkout-order-record";

/**
 * Fixtures are built the way composeOrderTotals builds an order —
 * goods − discount + goods VAT + delivery + VAT on delivery, each part rounded
 * before the sum — so the reader can check them by hand. The per-line VAT is
 * what createOrder persists on each OrderItem.
 */
const aeOrder = {
  subtotal: 1000,
  discountAmount: 100,
  // 5% of 900 (after discount) on the goods.
  vatAmount: 45 + 1.25,
  shippingAmount: 25,
  total: 1000 - 100 + 45 + 25 + 1.25,
  items: [
    { sku: "A", nameEn: "A", nameAr: "أ", quantity: 1, unitPrice: 600, vatRate: 5, vatAmount: 27, total: 567 },
    { sku: "B", nameEn: "B", nameAr: "ب", quantity: 1, unitPrice: 400, vatRate: 5, vatAmount: 18, total: 378 },
  ],
};

describe("reconcilePersistedTotals", () => {
  it("reads the six invoice lines back from persisted figures alone", () => {
    const totals = reconcilePersistedTotals(aeOrder);
    expect(totals).toEqual({
      subtotal: 1000,
      discountAmount: 100,
      shippingAmount: 25,
      vatAmount: 46.25,
      total: 971.25,
      goodsVatAmount: 45,
      shippingVatAmount: 1.25,
      splitSource: "LINE_ROWS",
      reconciles: true,
    });
  });

  it("prefers the split the order recorded, when it recorded one that sums to its VAT", () => {
    const recorded = reconcilePersistedTotals({ ...aeOrder, goodsVatAmount: 45, shippingVatAmount: 1.25 });
    expect(recorded).toMatchObject({ goodsVatAmount: 45, shippingVatAmount: 1.25, splitSource: "PERSISTED" });
    // A recorded split that contradicts the recorded VAT is not printed; the line rows stand in.
    const contradicted = reconcilePersistedTotals({ ...aeOrder, goodsVatAmount: 40, shippingVatAmount: 1.25 });
    expect(contradicted).toMatchObject({ goodsVatAmount: 45, shippingVatAmount: 1.25, splitSource: "LINE_ROWS" });
    // One half recorded without the other is "not recorded".
    expect(reconcilePersistedTotals({ ...aeOrder, goodsVatAmount: 45, shippingVatAmount: null }).splitSource).toBe("LINE_ROWS");
  });

  it("handles a zero-rated jurisdiction, where delivery VAT is genuinely zero", () => {
    const qa = {
      subtotal: 200, discountAmount: 0, vatAmount: 0, shippingAmount: 30, total: 230,
      items: [{ sku: "A", nameEn: "A", nameAr: "أ", quantity: 2, unitPrice: 100, vatRate: 0, vatAmount: 0, total: 200 }],
    };
    expect(reconcilePersistedTotals(qa)).toMatchObject({ goodsVatAmount: 0, shippingVatAmount: 0, reconciles: true });
  });

  it("does not produce binary noise when separating two-decimal figures", () => {
    const sa = {
      subtotal: 0.7, discountAmount: 0, vatAmount: 0.1 + 0.2, shippingAmount: 1.33, total: 2.33,
      items: [{ sku: "A", nameEn: "A", nameAr: "أ", quantity: 1, unitPrice: 0.7, vatRate: 15, vatAmount: 0.1, total: 0.8 }],
    };
    const totals = reconcilePersistedTotals(sa);
    expect(totals.goodsVatAmount).toBe(0.1);
    expect(totals.shippingVatAmount).toBe(0.2);
    expect(totals.reconciles).toBe(true);
  });

  it("withholds the split rather than print one that cannot hold", () => {
    // No line rows: nothing to add up.
    expect(reconcilePersistedTotals({ ...aeOrder, items: [] })).toMatchObject({ goodsVatAmount: null, shippingVatAmount: null, splitSource: null });
    // Line VAT exceeding the order VAT: the remainder would be negative.
    expect(reconcilePersistedTotals({ ...aeOrder, vatAmount: 40 })).toMatchObject({ goodsVatAmount: null, shippingVatAmount: null });
    // Delivery VAT on an order with no delivery charge.
    expect(reconcilePersistedTotals({ ...aeOrder, shippingAmount: 0, total: 946.25 })).toMatchObject({ goodsVatAmount: null, shippingVatAmount: null });
  });

  it("reports when the persisted figures do not add up to the persisted total", () => {
    expect(reconcilePersistedTotals({ ...aeOrder, total: 971.26 }).reconciles).toBe(false);
  });
});

describe("parsePersistedOrder", () => {
  const row = {
    id: "o1",
    orderNumber: "AVK-1",
    status: "PENDING_PAYMENT",
    paymentMethod: "BANK_TRANSFER",
    currency: "AED",
    subtotal: "1000.00",
    discountAmount: "100.00",
    vatAmount: "46.25",
    shippingAmount: "25.00",
    total: "971.25",
    shippingAddress: { label: "Office", line1: "12 Road", city: "Dubai", country: "AE" },
    items: [{ sku: "A", nameEn: "A", nameAr: "أ", quantity: 1, unitPrice: "600.00", vatRate: "5.00", vatAmount: "27.00", total: "567.00" }],
  };

  it("reads the API's Decimal strings as numbers", () => {
    const order = parsePersistedOrder(row);
    expect(order).toMatchObject({ id: "o1", status: "PENDING_PAYMENT", subtotal: 1000, vatAmount: 46.25, total: 971.25 });
    expect(order?.items[0]).toMatchObject({ unitPrice: 600, vatRate: 5, vatAmount: 27 });
    expect(order?.shippingAddress).toEqual({ label: "Office", line1: "12 Road", city: "Dubai", country: "AE" });
    // Columns that exist but were never written read back as "not recorded".
    expect(order).toMatchObject({ goodsVatAmount: null, shippingVatAmount: null });
    expect(parsePersistedOrder({ ...row, goodsVatAmount: "45.00", shippingVatAmount: "1.25" })).toMatchObject({ goodsVatAmount: 45, shippingVatAmount: 1.25 });
  });

  it("rejects an incomplete money record as a whole", () => {
    expect(parsePersistedOrder({ ...row, total: undefined })).toBeNull();
    expect(parsePersistedOrder({ ...row, status: "READY_FOR_PICKUP" })).toBeNull();
    expect(parsePersistedOrder({ ...row, items: [{ sku: "A", quantity: 1 }] })).toBeNull();
    expect(parsePersistedOrder(null)).toBeNull();
  });
});

describe("the status flow", () => {
  it("is the Prisma enum's forward path, in enum order", () => {
    expect(ORDER_FLOW).toEqual(["PENDING_PAYMENT", "PAYMENT_CONFIRMED", "CONFIRMED", "PROCESSING", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"]);
    for (const status of ORDER_FLOW) expect(ORDER_STATUS_VALUES).toContain(status);
    expect(flowPosition("CONFIRMED")).toBe(2);
    expect(flowPosition("CANCELLED")).toBe(-1);
  });

  it("describes the platform's next step, and only the bank-transfer branch depends on the method", () => {
    expect(whatHappensNext("PENDING_PAYMENT", "BANK_TRANSFER")).toBe("AWAIT_BANK_TRANSFER");
    expect(whatHappensNext("PENDING_PAYMENT", "MADA")).toBe("AWAIT_PAYMENT");
    expect(whatHappensNext("CONFIRMED", "MOCK")).toBe("CONFIRMED");
    expect(whatHappensNext("DELIVERED", "BANK_TRANSFER")).toBe("DELIVERED");
    expect(whatHappensNext("RETURN_REQUESTED", null)).toBe("RETURN_REQUESTED");
    expect(whatHappensNext("NOT_A_STATUS", null)).toBe("AWAIT_PAYMENT");
  });

  it("offers buyers the real enum, less the pilot simulation", () => {
    expect(BUYER_PAYMENT_METHODS).toEqual(["MADA", "APPLE_PAY", "CREDIT_CARD", "BANK_TRANSFER", "STC_PAY"]);
  });
});
