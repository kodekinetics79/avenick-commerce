"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, CheckCircle, Send, AlertCircle } from "lucide-react";
import { SellerLayout } from "@/components/layout/seller-layout";
import { MOCK_SELLER_RFQ_INBOX } from "@avenick/database";
import { Input, Textarea } from "@avenick/ui";

interface QuoteLineItem {
  id: string;
  description: string;
  qty: string;
  unit: string;
  unitPrice: string;
  leadTimeDays: string;
}

export default function SubmitQuotePage() {
  const searchParams = useSearchParams();
  const rfqId = searchParams.get("rfq");
  const rfq = MOCK_SELLER_RFQ_INBOX.find((r) => r.id === rfqId);

  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validUntil, setValidUntil] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("NET_30");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<QuoteLineItem[]>([
    { id: "1", description: rfq?.description ?? "", qty: "", unit: "pcs", unitPrice: "", leadTimeDays: "7" },
  ]);

  const subtotal = items.reduce((s, i) => s + (parseFloat(i.unitPrice) || 0) * (parseInt(i.qty) || 0), 0);
  const vatAmount = subtotal * 0.05;
  const total = subtotal + vatAmount;

  function addItem() {
    setItems((prev) => [...prev, { id: String(Date.now()), description: "", qty: "", unit: "pcs", unitPrice: "", leadTimeDays: "7" }]);
  }

  function removeItem(id: string) {
    if (items.length > 1) setItems((prev) => prev.filter((i) => i.id !== id));
  }

  function updateItem(id: string, field: keyof QuoteLineItem, value: string) {
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, [field]: value } : i));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => { setLoading(false); setSubmitted(true); }, 1200);
  }

  if (submitted) {
    return (
      <SellerLayout sellerName="Seller" tier="VERIFIED">
        <div className="max-w-lg mx-auto py-20 text-center">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-5">
            <CheckCircle className="h-10 w-10 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Quote Submitted!</h1>
          <p className="text-muted-foreground mb-6">Your quotation has been sent to the buyer. They will review and respond within 48 hours.</p>
          <div className="flex gap-3 justify-center">
            <Link href="/messages" className="bg-slate-900 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors">
              Back to Messages
            </Link>
            <Link href="/quotes" className="border border-border px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors">
              View Quote History
            </Link>
          </div>
        </div>
      </SellerLayout>
    );
  }

  return (
    <SellerLayout sellerName="Seller" tier="VERIFIED">
      <div className="max-w-3xl">
        <Link href="/messages" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Messages
        </Link>

        <div className="mb-6">
          <h1 className="text-2xl font-bold">Submit Quotation</h1>
          <p className="text-sm text-muted-foreground mt-1">Respond to RFQ {rfq?.rfqNumber ?? rfqId} from {rfq?.buyerCompany ?? "Buyer"}</p>
        </div>

        {/* RFQ summary */}
        {rfq && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-5">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold text-blue-800">RFQ Details</p>
                <p className="text-blue-700">{rfq.description}</p>
                <p className="text-blue-600 text-xs mt-1">Received: {rfq.receivedAt} · Due: {rfq.dueBy}</p>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Quote header */}
          <div className="bg-white rounded-2xl border border-border p-5">
            <h2 className="font-semibold mb-4">Quote Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Valid Until <span className="text-red-500">*</span></label>
                <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Payment Terms</label>
                <select aria-label="Payment terms" value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)}
                  className="w-full h-10 px-3 text-sm border border-border rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-slate-900">
                  {[["NET_30","Net 30 Days"],["NET_15","Net 15 Days"],["NET_60","Net 60 Days"],["ADVANCE","100% Advance"],["PARTIAL","50% Advance, 50% on Delivery"]].map(([v,l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Line items */}
          <div className="bg-white rounded-2xl border border-border p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Line Items</h2>
              <button type="button" onClick={addItem}
                className="flex items-center gap-1.5 text-sm text-green-600 font-medium border border-green-200 px-3 py-1.5 rounded-lg hover:bg-green-50 transition-colors">
                <Plus className="h-3.5 w-3.5" /> Add Item
              </button>
            </div>
            <div className="space-y-3">
              {items.map((item, idx) => (
                <div key={item.id} className="border border-border rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-muted-foreground uppercase">Item {idx + 1}</span>
                    {items.length > 1 && (
                      <button type="button" aria-label="Remove item" onClick={() => removeItem(item.id)} className="text-muted-foreground hover:text-red-500 transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="col-span-2 sm:col-span-3">
                      <label className="block text-xs font-medium mb-1">Description <span className="text-red-500">*</span></label>
                      <Input value={item.description} onChange={(e) => updateItem(item.id, "description", e.target.value)} placeholder="Product name and specifications" required />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Quantity <span className="text-red-500">*</span></label>
                      <Input type="number" value={item.qty} onChange={(e) => updateItem(item.id, "qty", e.target.value)} placeholder="100" min={1} required />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Unit Price (AED) <span className="text-red-500">*</span></label>
                      <Input type="number" value={item.unitPrice} onChange={(e) => updateItem(item.id, "unitPrice", e.target.value)} placeholder="0.00" min={0} step="0.01" required />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Lead Time (days)</label>
                      <Input type="number" value={item.leadTimeDays} onChange={(e) => updateItem(item.id, "leadTimeDays", e.target.value)} placeholder="7" min={1} />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Totals */}
            {subtotal > 0 && (
              <div className="mt-4 pt-4 border-t border-border space-y-1.5 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span><span>AED {subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>VAT (5%)</span><span>AED {vatAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-base border-t border-border pt-1.5">
                  <span>Total</span><span className="text-green-700">AED {total.toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="bg-white rounded-2xl border border-border p-5">
            <h2 className="font-semibold mb-3">Notes to Buyer</h2>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Include delivery terms, product specifications, certifications, warranty, or any other relevant information..." rows={3} />
          </div>

          <button type="submit" disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-60 text-sm">
            {loading ? (
              <span className="flex items-center gap-2"><span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Submitting...</span>
            ) : (
              <><Send className="h-4 w-4" /> Submit Quotation to Buyer</>
            )}
          </button>
        </form>
      </div>
    </SellerLayout>
  );
}
