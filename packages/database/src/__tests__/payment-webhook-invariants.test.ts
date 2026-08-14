import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import {
  checkoutPaymentTransition,
  assertInternalPaymentMethodMatches,
  expectedCheckoutMinorAmount,
  validateCheckoutEventAgainstAttempt,
  type CheckoutPaymentEvent,
} from "../services/payments";

const event: CheckoutPaymentEvent = {
  eventId: "evt_1",
  type: "payment_approved",
  paymentId: "pay_1",
  orderId: "order_1",
  paymentAttemptId: "attempt_1",
  amount: 12345,
  currency: "aed",
};

const payment = {
  id: "attempt_1",
  orderId: "order_1",
  method: "CREDIT_CARD" as const,
  amount: new Prisma.Decimal("123.45"),
  currency: "AED" as const,
  gatewayRef: null,
  gatewayData: { checkoutPaymentId: "pay_1" },
};

describe("Checkout payment webhook invariants", () => {
  it("validates immutable attempt, gateway, amount and currency identity", () => {
    expect(validateCheckoutEventAgainstAttempt({ event, payment })).toMatchObject({ checkoutPaymentId: "pay_1" });
    expect(() => validateCheckoutEventAgainstAttempt({ event: { ...event, amount: 12344 }, payment })).toThrow(/amount/);
    expect(() => validateCheckoutEventAgainstAttempt({ event: { ...event, currency: "SAR" }, payment })).toThrow(/currency/);
    expect(() => validateCheckoutEventAgainstAttempt({ event: { ...event, paymentAttemptId: "attempt_2" }, payment })).toThrow(/attempt/);
    expect(() => validateCheckoutEventAgainstAttempt({ event: { ...event, paymentId: "pay_other" }, payment })).toThrow(/gateway/);
  });

  it("rejects webhook finalization for internal rails", () => {
    expect(() => validateCheckoutEventAgainstAttempt({
      event,
      payment: { ...payment, method: "BANK_TRANSFER" },
    })).toThrow(/non-Checkout/);
  });

  it("requires the internal finalizer rail to match the stored order method", () => {
    expect(() => assertInternalPaymentMethodMatches("BANK_TRANSFER", "MOCK")).toThrow(/does not match/);
    expect(() => assertInternalPaymentMethodMatches("MOCK", "BANK_TRANSFER")).toThrow(/does not match/);
    expect(() => assertInternalPaymentMethodMatches(null, "MOCK")).toThrow(/NONE/);
    expect(() => assertInternalPaymentMethodMatches("BANK_TRANSFER", "BANK_TRANSFER")).not.toThrow();
    expect(() => assertInternalPaymentMethodMatches("MOCK", "MOCK")).not.toThrow();
  });

  it("requires exact minor-unit amounts", () => {
    expect(expectedCheckoutMinorAmount("123.45")).toBe(12345);
    expect(() => expectedCheckoutMinorAmount("1.001")).toThrow(/minor currency units/);
  });

  it("keeps terminal attempt outcomes monotonic and recognizes same-outcome replay", () => {
    expect(checkoutPaymentTransition("UNPAID", "payment_approved")).toEqual({ next: "PAID", replay: false });
    expect(checkoutPaymentTransition("PAID", "payment_approved")).toEqual({ next: "PAID", replay: true });
    expect(checkoutPaymentTransition("FAILED", "payment_declined")).toEqual({ next: "FAILED", replay: true });
    expect(() => checkoutPaymentTransition("PAID", "payment_declined")).toThrow(/cannot move/);
    expect(() => checkoutPaymentTransition("FAILED", "payment_approved")).toThrow(/cannot move/);
    expect(() => checkoutPaymentTransition("REFUNDED", "payment_approved")).toThrow(/cannot move/);
  });
});
