"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Building2, Smartphone, CheckCircle } from "lucide-react";
import { Button, Input } from "@manzil/ui";
import { formatCurrency, VAT_RATES } from "@manzil/utils";
import { useCartStore } from "@/stores/cart";
import { MainLayout } from "@/components/layout/main-layout";

type Step = "address" | "payment" | "review" | "success";

const PAYMENT_METHODS = [
  { id: "MOCK", label: "Test Payment (Dev)", labelAr: "دفع تجريبي", icon: CheckCircle, desc: "Mock payment for development" },
  { id: "CREDIT_CARD", label: "Credit / Debit Card", labelAr: "بطاقة ائتمانية / مدينة", icon: CreditCard, desc: "Visa, Mastercard" },
  { id: "MADA", label: "mada", labelAr: "مدى", icon: CreditCard, desc: "Saudi debit card" },
  { id: "BANK_TRANSFER", label: "Bank Transfer", labelAr: "تحويل بنكي", icon: Building2, desc: "Pay by IBAN transfer" },
  { id: "APPLE_PAY", label: "Apple Pay", labelAr: "آبل باي", icon: Smartphone, desc: "Available on Safari iOS/Mac" },
];

export default function CheckoutPage() {
  const router = useRouter();
  const { items, total, clearCart } = useCartStore();
  const [step, setStep] = useState<Step>("address");
  const [paymentMethod, setPaymentMethod] = useState("MOCK");
  const [loading, setLoading] = useState(false);
  const [orderNumber, setOrderNumber] = useState("");
  const [address, setAddress] = useState({ label: "Home", line1: "", city: "Dubai", country: "AE" });

  const subtotal = total();
  const vatAmount = subtotal * 0.05;
  const orderTotal = subtotal + vatAmount;

  async function placeOrder() {
    setLoading(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({ productId: i.productId, variantId: i.variantId, quantity: i.qty, unitPrice: i.unitPrice, sellerId: i.sellerId })),
          shippingAddress: address,
          paymentMethod,
          currency: "AED",
          type: "B2C",
        }),
      });
      const data = await res.json();
      if (data.success) {
        setOrderNumber(data.data.orderNumber);
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
          <p className="text-muted-foreground">Your cart is empty. <a href="/products" className="text-orange-600 underline">Shop now</a></p>
        </div>
      </MainLayout>
    );
  }

  if (step === "success") {
    return (
      <MainLayout>
        <div className="max-w-xl mx-auto px-4 py-20 text-center">
          <CheckCircle className="h-16 w-16 mx-auto text-green-500 mb-4" />
          <h1 className="text-2xl font-bold mb-2">Order Placed!</h1>
          <p className="text-muted-foreground mb-2">تم تأكيد الطلب بنجاح</p>
          <p className="text-lg font-semibold text-orange-600 mb-6">Order #{orderNumber}</p>
          <Button asChild variant="primary"><a href="/account/orders">View My Orders</a></Button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Checkout — إتمام الشراء</h1>

        {/* Steps */}
        <div className="flex items-center gap-2 mb-8">
          {(["address", "payment", "review"] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold ${step === s ? "bg-orange-500 text-white" : "bg-muted text-muted-foreground"}`}>{i + 1}</div>
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
                <div className="space-y-2">
                  {PAYMENT_METHODS.map((pm) => (
                    <button
                      key={pm.id}
                      onClick={() => setPaymentMethod(pm.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-start ${paymentMethod === pm.id ? "border-orange-500 bg-orange-50" : "border-border hover:border-orange-300"}`}
                    >
                      <pm.icon className={`h-5 w-5 shrink-0 ${paymentMethod === pm.id ? "text-orange-500" : "text-muted-foreground"}`} />
                      <div>
                        <p className="font-medium text-sm">{pm.label} — {pm.labelAr}</p>
                        <p className="text-xs text-muted-foreground">{pm.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
                {/* TODO: Checkout.com hosted fields for CREDIT_CARD */}
                <div className="flex gap-3 mt-4">
                  <Button variant="outline" onClick={() => setStep("address")}>Back</Button>
                  <Button className="flex-1" onClick={() => setStep("review")}>Review Order</Button>
                </div>
              </div>
            )}

            {step === "review" && (
              <div className="bg-white rounded-2xl border border-border p-6">
                <h2 className="font-semibold mb-4">Review Your Order</h2>
                <div className="space-y-2 mb-4">
                  {items.map((item) => (
                    <div key={item.id} className="flex justify-between text-sm py-2 border-b border-border last:border-0">
                      <div>
                        <p className="font-medium">{item.nameAr}</p>
                        <p className="text-xs text-muted-foreground">x{item.qty} @ {formatCurrency(item.unitPrice, "AED")}</p>
                      </div>
                      <span className="font-semibold">{formatCurrency(item.unitPrice * item.qty, "AED")}</span>
                    </div>
                  ))}
                </div>
                <div className="bg-muted rounded-xl p-3 text-sm space-y-1 mb-4">
                  <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatCurrency(subtotal, "AED")}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">VAT (5%)</span><span>{formatCurrency(vatAmount, "AED")}</span></div>
                  <div className="flex justify-between font-bold"><span>Total</span><span className="text-orange-600">{formatCurrency(orderTotal, "AED")}</span></div>
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep("payment")}>Back</Button>
                  <Button className="flex-1" loading={loading} onClick={placeOrder}>Place Order</Button>
                </div>
              </div>
            )}
          </div>

          {/* Summary sidebar */}
          <div className="bg-white rounded-2xl border border-border p-4 h-fit">
            <h3 className="font-semibold mb-3 text-sm">Order Summary ({items.length} items)</h3>
            <div className="space-y-1 text-sm mb-3">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatCurrency(subtotal, "AED")}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">VAT 5%</span><span>{formatCurrency(vatAmount, "AED")}</span></div>
              <hr />
              <div className="flex justify-between font-bold"><span>Total</span><span className="text-orange-600">{formatCurrency(orderTotal, "AED")}</span></div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
