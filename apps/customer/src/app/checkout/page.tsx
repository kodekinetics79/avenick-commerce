"use client";

import { useRef, useState } from "react";
import { CreditCard, Building2, Smartphone, CheckCircle, TicketPercent } from "lucide-react";
import { Button, Input } from "@avenick/ui";
import { formatCurrency } from "@avenick/utils";
import { useCartStore } from "@/stores/cart";
import { MainLayout } from "@/components/layout/main-layout";
import { summarizeCartCommercial } from "@/lib/cart-commercial";

type Step = "address" | "payment" | "review" | "success";
type OrderSummary = { total?: number; discountAmount?: number; vatAmount?: number };

const PILOT_MODE = process.env.NEXT_PUBLIC_PILOT_MODE === "true";

const PAYMENT_METHODS = [
  { id: "MOCK", label: "Test payment (pilot)", labelAr: "دفع تجريبي (تجريبي)", icon: CheckCircle, desc: "Pilot simulation — no card is charged", enabled: PILOT_MODE },
  { id: "BANK_TRANSFER", label: "Bank Transfer", labelAr: "تحويل بنكي", icon: Building2, desc: "Creates an unpaid order for finance confirmation", enabled: true },
  { id: "CREDIT_CARD", label: "Credit / Debit Card", labelAr: "بطاقة ائتمانية / مدينة", icon: CreditCard, desc: "Requires certified payment initiation", enabled: false },
  { id: "MADA", label: "mada", labelAr: "مدى", icon: CreditCard, desc: "Requires certified payment initiation", enabled: false },
  { id: "APPLE_PAY", label: "Apple Pay", labelAr: "آبل باي", icon: Smartphone, desc: "Requires certified payment initiation", enabled: false },
];

export default function CheckoutPage() {
  const { items, clearCart } = useCartStore();
  const [step, setStep] = useState<Step>("address");
  const [paymentMethod, setPaymentMethod] = useState(PILOT_MODE ? "MOCK" : "BANK_TRANSFER");
  const [couponCode, setCouponCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [orderNumber, setOrderNumber] = useState("");
  const [finalSummary, setFinalSummary] = useState<OrderSummary>({});
  const [address, setAddress] = useState({ label: "Home", line1: "", city: "Dubai", country: "AE" });
  const idempotencyKeyRef = useRef<string | null>(null);

  const summary = summarizeCartCommercial(items);
  const checkoutCurrency = summary.valid ? summary.currency : "AED";
  const mixedCurrencies = !summary.valid;
  const subtotal = summary.valid ? summary.subtotal : 0;
  const vatAmount = summary.valid ? summary.vatAmount : 0;
  const orderTotal = summary.valid ? summary.total : 0;

  async function placeOrder() {
    setLoading(true);
    try {
      if (mixedCurrencies) throw new Error("Cart items must use one currency per checkout");
      if (!idempotencyKeyRef.current) {
        idempotencyKeyRef.current = globalThis.crypto?.randomUUID?.() ?? `checkout-${Date.now()}-${Math.random()}`;
      }

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKeyRef.current,
        },
        body: JSON.stringify({
          // Cart price and seller are display hints only. The server re-resolves
          // both from the authoritative catalog at checkout.
          items: items.map((i) => ({ productId: i.productId, variantId: i.variantId, quantity: i.qty })),
          shippingAddress: address,
          paymentMethod,
          currency: checkoutCurrency,
          type: "B2C",
          couponCode: couponCode.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setOrderNumber(data.data.orderNumber);
        setFinalSummary({
          total: data.data.total == null ? undefined : Number(data.data.total),
          discountAmount: data.data.discountAmount == null ? undefined : Number(data.data.discountAmount),
          vatAmount: data.data.vatAmount == null ? undefined : Number(data.data.vatAmount),
        });
        clearCart();
        setStep("success");
      } else {
        alert(data.error ?? "Order failed");
      }
    } catch {
      alert("Order failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (items.length === 0 && step !== "success") {
    return (
      <MainLayout>
        <div className="max-w-xl mx-auto px-4 py-20 text-center">
          <p className="text-muted-foreground">Your cart is empty. <a href="/products" className="text-primary underline">Shop now</a></p>
        </div>
      </MainLayout>
    );
  }

  if (step === "success") {
    return (
      <MainLayout>
        <div className="max-w-xl mx-auto px-4 py-20 text-center">
          <CheckCircle className="h-16 w-16 mx-auto text-primary/100 mb-4" />
          <h1 className="text-2xl font-bold mb-2">Order Submitted</h1>
          <p className="text-muted-foreground mb-2">تم إرسال الطلب بنجاح</p>
          <p className="text-lg font-semibold text-primary mb-2">Order #{orderNumber}</p>
          {finalSummary.total != null && (
            <div className="mx-auto mb-5 max-w-sm rounded-xl bg-muted p-3 text-sm text-left">
              {finalSummary.discountAmount != null && finalSummary.discountAmount > 0 && (
                <div className="flex justify-between"><span>Discount</span><span>-{formatCurrency(finalSummary.discountAmount, checkoutCurrency as never)}</span></div>
              )}
              {finalSummary.vatAmount != null && <div className="flex justify-between"><span>VAT</span><span>{formatCurrency(finalSummary.vatAmount, checkoutCurrency as never)}</span></div>}
              <div className="flex justify-between font-semibold mt-1"><span>Final total</span><span>{formatCurrency(finalSummary.total, checkoutCurrency as never)}</span></div>
            </div>
          )}
          <p className="text-sm text-muted-foreground mb-6">
            {paymentMethod === "BANK_TRANSFER"
              ? "Payment is pending finance confirmation. The order is not marked paid until funds are verified."
              : "Pilot test payment recorded — no card was charged."}
          </p>
          <Button asChild variant="primary"><a href="/account/orders">View My Orders</a></Button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Checkout — إتمام الشراء</h1>

        <div className="flex items-center gap-2 mb-8">
          {(["address", "payment", "review"] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold ${step === s ? "bg-primary/100 text-white" : "bg-muted text-muted-foreground"}`}>{i + 1}</div>
              <span className={`text-sm ${step === s ? "font-semibold" : "text-muted-foreground"}`}>{s.charAt(0).toUpperCase() + s.slice(1)}</span>
              {i < 2 && <div className="w-8 h-px bg-border" />}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            {step === "address" && (
              <div className="bg-white rounded-2xl border border-border p-6">
                <h2 className="font-semibold mb-4">Delivery Address</h2>
                <div className="space-y-3">
                  <Input placeholder="Address label (e.g. Home, Office)" value={address.label} onChange={(e) => setAddress({ ...address, label: e.target.value })} />
                  <Input placeholder="Street address" value={address.line1} onChange={(e) => setAddress({ ...address, line1: e.target.value })} />
                  <div className="grid grid-cols-2 gap-3">
                    <Input placeholder="City" value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} />
                    <select value={address.country} onChange={(e) => setAddress({ ...address, country: e.target.value })} className="h-10 rounded-xl border border-input bg-background px-3 text-sm focus:ring-2 focus:ring-ring">
                      <option value="AE">UAE 🇦🇪</option>
                      <option value="SA">Saudi Arabia 🇸🇦</option>
                      <option value="QA">Qatar 🇶🇦</option>
                      <option value="KW">Kuwait 🇰🇼</option>
                      <option value="BH">Bahrain 🇧🇭</option>
                      <option value="OM">Oman 🇴🇲</option>
                    </select>
                  </div>
                </div>
                <Button className="mt-4 w-full" onClick={() => setStep("payment")} disabled={!address.line1}>Continue to Payment</Button>
              </div>
            )}

            {step === "payment" && (
              <div className="bg-white rounded-2xl border border-border p-6">
                <h2 className="font-semibold mb-4">Payment Method</h2>
                {PILOT_MODE && (
                  <div className="mb-4 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
                    Pilot mode is explicitly enabled. Test payment records are simulation-only and never represent a card charge.
                  </div>
                )}
                <div className="space-y-2">
                  {PAYMENT_METHODS.map((pm) => (
                    <button key={pm.id} onClick={() => pm.enabled && setPaymentMethod(pm.id)} disabled={!pm.enabled} className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-start ${paymentMethod === pm.id ? "border-primary/100 bg-primary/10" : pm.enabled ? "border-border hover:border-primary/40" : "border-border opacity-55 cursor-not-allowed"}`}>
                      <pm.icon className={`h-5 w-5 shrink-0 ${paymentMethod === pm.id ? "text-primary/100" : "text-muted-foreground"}`} />
                      <div className="flex-1"><p className="font-medium text-sm">{pm.label} — {pm.labelAr}</p><p className="text-xs text-muted-foreground">{pm.desc}</p></div>
                      {!pm.enabled && <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Not enabled</span>}
                    </button>
                  ))}
                </div>
                <div className="flex gap-3 mt-4"><Button variant="outline" onClick={() => setStep("address")}>Back</Button><Button className="flex-1" onClick={() => setStep("review")}>Review Order</Button></div>
              </div>
            )}

            {step === "review" && (
              <div className="bg-white rounded-2xl border border-border p-6">
                <h2 className="font-semibold mb-4">Review Your Order</h2>
                <div className="space-y-2 mb-4">
                  {items.map((item) => (
                    <div key={item.id} className="flex justify-between text-sm py-2 border-b border-border last:border-0">
                      <div><p className="font-medium">{item.nameAr}</p><p className="text-xs text-muted-foreground">x{item.qty} @ {formatCurrency(item.unitPrice, item.currency as never)} · VAT {item.vatRate ?? "missing"}%</p></div>
                      <span className="font-semibold">{formatCurrency(item.unitPrice * item.qty, item.currency as never)}</span>
                    </div>
                  ))}
                </div>

                <div className="rounded-xl border p-3 mb-4">
                  <label className="flex items-center gap-2 text-sm font-medium mb-2"><TicketPercent className="h-4 w-4" /> Coupon / event code</label>
                  <Input value={couponCode} onChange={(event) => setCouponCode(event.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""))} maxLength={40} placeholder="Optional code" />
                  <p className="text-[11px] text-muted-foreground mt-2">The code is validated against current eligibility, usage limits and stacking rules when you submit. The browser does not calculate or authorize the discount.</p>
                </div>

                <div className="bg-muted rounded-xl p-3 text-sm space-y-1 mb-4">
                  <div className="flex justify-between"><span className="text-muted-foreground">Displayed subtotal</span><span>{formatCurrency(subtotal, checkoutCurrency as never)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Estimated VAT</span><span>{formatCurrency(vatAmount, checkoutCurrency as never)}</span></div>
                  <div className="flex justify-between font-bold"><span>Pre-validation estimate</span><span className="text-primary">{formatCurrency(orderTotal, checkoutCurrency as never)}</span></div>
                  {mixedCurrencies && <p className="pt-1 text-[11px] text-destructive">Remove items in other currencies before checkout.</p>}
                  <p className="pt-1 text-[11px] text-muted-foreground">Final price, discounts, availability and tax are revalidated by the server. An eligible coupon may reduce this total.</p>
                </div>
                <div className="flex gap-3"><Button variant="outline" onClick={() => setStep("payment")}>Back</Button><Button className="flex-1" loading={loading} disabled={mixedCurrencies} onClick={placeOrder}>Submit Order</Button></div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-border p-4 h-fit">
            <h3 className="font-semibold mb-3 text-sm">Order Summary ({items.length} items)</h3>
            <div className="space-y-1 text-sm mb-3">
              <div className="flex justify-between"><span className="text-muted-foreground">Displayed subtotal</span><span>{formatCurrency(subtotal, checkoutCurrency as never)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Estimated VAT</span><span>{formatCurrency(vatAmount, checkoutCurrency as never)}</span></div>
              <hr />
              <div className="flex justify-between font-bold"><span>Estimate</span><span className="text-primary">{formatCurrency(orderTotal, checkoutCurrency as never)}</span></div>
              {couponCode && <p className="pt-2 text-[11px] text-muted-foreground">Code <span className="font-mono">{couponCode}</span> will be validated on submit.</p>}
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
