import { Building2, CheckCircle, CreditCard, Smartphone, Wallet, type LucideIcon } from "lucide-react";
import type { PaymentMethodValue } from "@/lib/checkout-order-record";

/**
 * The Prisma PaymentMethod enum, as a buyer reads it.
 *
 * One table for the label, the icon, and — the part that matters — what
 * choosing the method actually does to the order and why the others are off.
 * The order route fails closed on MADA, Apple Pay, card and STC Pay ("Online
 * payment initiation is not enabled for this deployment", 503), so those are
 * offered with that reason rather than hidden: a disabled method with no
 * stated reason reads as a broken product; with the reason, it reads as a
 * regulated one. MOCK is offered only where the route's own gate
 * (PILOT_MODE && ALLOW_MOCK_PAYMENTS) would accept it.
 */
export interface PaymentMethodPresentation {
  id: PaymentMethodValue;
  icon: LucideIcon;
  labelKey: string;
  label: string;
  descKey: string;
  desc: string;
  /** Whether the order route would accept this method today. */
  enabled: boolean;
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethodValue, { key: string; fallback: string }> = {
  MADA: { key: "checkout.pay.mada", fallback: "mada" },
  APPLE_PAY: { key: "checkout.pay.applePay", fallback: "Apple Pay" },
  CREDIT_CARD: { key: "checkout.creditCard", fallback: "Credit or debit card" },
  BANK_TRANSFER: { key: "checkout.bankTransfer", fallback: "Bank transfer" },
  STC_PAY: { key: "checkout.pay.stcPay", fallback: "STC Pay" },
  MOCK: { key: "checkout.pay.mock", fallback: "Test payment (pilot)" },
};

const labelOf = (id: PaymentMethodValue) => ({
  labelKey: PAYMENT_METHOD_LABELS[id].key,
  label: PAYMENT_METHOD_LABELS[id].fallback,
});

const CERTIFICATION = {
  descKey: "checkout.pay.certification",
  desc: "Requires certified payment initiation",
  enabled: false,
} as const;

export function paymentMethodsFor(mockPaymentsEnabled: boolean): PaymentMethodPresentation[] {
  const methods: PaymentMethodPresentation[] = [
    {
      id: "BANK_TRANSFER",
      icon: Building2,
      ...labelOf("BANK_TRANSFER"),
      descKey: "checkout.pay.bankDesc",
      desc: "Creates an unpaid order for finance confirmation",
      enabled: true,
    },
    { id: "CREDIT_CARD", icon: CreditCard, ...labelOf("CREDIT_CARD"), ...CERTIFICATION },
    { id: "MADA", icon: CreditCard, ...labelOf("MADA"), ...CERTIFICATION },
    { id: "APPLE_PAY", icon: Smartphone, ...labelOf("APPLE_PAY"), ...CERTIFICATION },
    { id: "STC_PAY", icon: Wallet, ...labelOf("STC_PAY"), ...CERTIFICATION },
  ];
  if (mockPaymentsEnabled) {
    methods.unshift({
      id: "MOCK",
      icon: CheckCircle,
      ...labelOf("MOCK"),
      descKey: "checkout.pay.mockDesc",
      desc: "Pilot simulation — no card is charged",
      enabled: true,
    });
  }
  return methods;
}
