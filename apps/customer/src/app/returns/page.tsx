"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, RotateCcw, CheckCircle, Package, AlertCircle } from "lucide-react";
import { MainLayout } from "@/components/layout/main-layout";
import { MOCK_ORDERS } from "@avenick/database";
import { Input, Textarea } from "@avenick/ui";

const RETURN_REASONS = [
  "Wrong item received",
  "Item damaged / defective",
  "Item not as described",
  "Changed my mind",
  "Order arrived too late",
  "Missing parts / accessories",
  "Other",
];

const RETURN_TYPES = [
  { id: "RETURN", label: "Return for Refund", desc: "Get a full refund to your original payment method" },
  { id: "EXCHANGE", label: "Exchange", desc: "Swap for a different size, color, or product" },
  { id: "REPAIR", label: "Repair / Warranty", desc: "For defective items under warranty" },
];

const deliveredOrders = MOCK_ORDERS.filter(o => o.status === "DELIVERED");

export default function ReturnsPage() {
  const [step, setStep] = useState<"list" | "form" | "success">("list");
  const [selectedOrder, setSelectedOrder] = useState<string>("");
  const [returnType, setReturnType] = useState("RETURN");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => { setLoading(false); setStep("success"); }, 1200);
  }

  if (step === "success") {
    return (
      <MainLayout>
        <div className="bg-background min-h-screen">
          <div className="max-w-lg mx-auto px-4 py-20 text-center">
            <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-5">
              <CheckCircle className="h-10 w-10 text-primary" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Return Submitted!</h1>
            <p className="text-muted-foreground mb-6">Your return request has been received. Our team will review it within 1–2 business days.</p>
            <div className="bg-card rounded-2xl border border-border p-4 mb-6 text-sm text-start">
              <p className="font-semibold mb-2">What happens next?</p>
              <ol className="space-y-1.5 text-muted-foreground">
                {["Return request reviewed by our team","Return label sent to your email","Ship the item back to us","Refund or exchange processed within 5 business days"].map((s, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                    {s}
                  </li>
                ))}
              </ol>
            </div>
            <div className="flex gap-3 justify-center">
              <Link href="/account/orders" className="bg-primary text-primary-foreground px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors">My Orders</Link>
              <Link href="/support" className="border border-border px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-secondary transition-colors">Contact Support</Link>
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (step === "form") {
    const order = MOCK_ORDERS.find(o => o.id === selectedOrder);
    return (
      <MainLayout>
        <div className="bg-background min-h-screen">
          <div className="max-w-2xl mx-auto px-4 py-8">
            <button type="button" onClick={() => setStep("list")} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            <h1 className="text-2xl font-bold mb-1">Return Request</h1>
            <p className="text-sm text-muted-foreground mb-6">Order {order?.orderNumber}</p>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Return type */}
              <div className="bg-card rounded-2xl border border-border p-5">
                <h2 className="font-semibold mb-3">What would you like to do?</h2>
                <div className="space-y-2">
                  {RETURN_TYPES.map((rt) => (
                    <label key={rt.id} className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${returnType === rt.id ? "border-primary/100 bg-primary/10" : "border-border hover:border-primary/20 hover:bg-secondary/40"}`}>
                      <input type="radio" name="returnType" value={rt.id} checked={returnType === rt.id} onChange={() => setReturnType(rt.id)} className="mt-0.5 accent-primary" />
                      <div>
                        <p className="font-medium text-sm">{rt.label}</p>
                        <p className="text-xs text-muted-foreground">{rt.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Items */}
              <div className="bg-card rounded-2xl border border-border p-5">
                <h2 className="font-semibold mb-3">Select items to return</h2>
                <div className="space-y-2">
                  {order?.items.map((item, i) => (
                    <label key={i} className="flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-secondary cursor-pointer">
                      <input type="checkbox" defaultChecked className="accent-primary h-4 w-4" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{item.nameEn}</p>
                        <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                      </div>
                      <select aria-label="Quantity to return" className="text-sm border border-border bg-card text-foreground rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary">
                        {Array.from({ length: item.quantity }, (_, j) => j + 1).map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </label>
                  ))}
                </div>
              </div>

              {/* Reason */}
              <div className="bg-card rounded-2xl border border-border p-5">
                <h2 className="font-semibold mb-3">Reason for return <span className="text-destructive">*</span></h2>
                <select aria-label="Return reason" required value={reason} onChange={e => setReason(e.target.value)}
                  className="w-full h-10 px-3 text-sm border border-border rounded-xl bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary mb-3">
                  <option value="">Select a reason...</option>
                  {RETURN_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Describe the issue in detail (optional)..." rows={3} />
              </div>

              <div className="flex items-start gap-2 bg-primary/10 border border-primary/20 rounded-xl p-3 text-sm text-primary">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <p>Items must be returned in original packaging and unused condition. Returns are accepted within 14 days of delivery.</p>
              </div>

              <button type="submit" disabled={!reason || loading}
                className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-60 text-sm">
                {loading ? <span className="flex items-center gap-2"><span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Submitting...</span> : <><RotateCcw className="h-4 w-4" /> Submit Return Request</>}
              </button>
            </form>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="bg-background min-h-screen">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <Link href="/account/orders" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back to My Orders
          </Link>

          <h1 className="text-2xl font-bold mb-1">Returns & Exchanges</h1>
          <p className="text-sm text-muted-foreground mb-6">Select an eligible order to start a return or exchange request.</p>

          {deliveredOrders.length === 0 ? (
            <div className="bg-card rounded-2xl border border-border p-16 text-center">
              <Package className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
              <p className="font-semibold text-muted-foreground">No eligible orders</p>
              <p className="text-sm text-muted-foreground mt-1">Only delivered orders within 14 days are eligible for returns.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {deliveredOrders.map((order) => (
                <div key={order.id} className="bg-card rounded-2xl border border-border p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-mono text-xs font-semibold text-muted-foreground mb-0.5">{order.orderNumber}</p>
                      <p className="text-sm font-medium">{order.items[0]?.nameEn}{order.items.length > 1 ? ` + ${order.items.length - 1} more` : ""}</p>
                      <p className="text-xs text-muted-foreground">Delivered on {order.createdAt} · AED {order.total.toFixed(2)}</p>
                    </div>
                    <button type="button" onClick={() => { setSelectedOrder(order.id); setStep("form"); }}
                      className="shrink-0 flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold px-3 py-2 rounded-xl transition-colors">
                      <RotateCcw className="h-3.5 w-3.5" /> Return / Exchange
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 bg-card rounded-2xl border border-border p-4 text-sm text-muted-foreground">
            <p className="font-semibold text-foreground mb-1">Return Policy</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>14 days from delivery date</li>
              <li>Items must be unused and in original packaging</li>
              <li>Refunds processed within 5 business days</li>
              <li>Free return shipping for defective items</li>
            </ul>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
