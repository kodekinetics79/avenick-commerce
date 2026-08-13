"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Building2, CheckCircle2, ShoppingCart } from "lucide-react";
import { B2BShell } from "@/components/b2b/b2b-shell";
import { useCartStore } from "@/stores/cart";
import { formatCurrency } from "@avenick/utils";

type CompanyContext = {
  companyName: string;
  country: string;
  currency: string;
  memberRole: string;
  spendLimit: number | null;
  paymentTermsDays: number;
  creditLimit: number | null;
};

type CreatedPO = {
  id: string;
  poNumber: string;
  status: string;
  total: string | number;
  currency: string;
};

export default function NewPurchaseOrderPage() {
  const { items, updateQty, removeItem, clearCart } = useCartStore();
  const [context, setContext] = useState<CompanyContext | null>(null);
  const [contextError, setContextError] = useState("");
  const [requiredDate, setRequiredDate] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<CreatedPO | null>(null);

  useEffect(() => {
    void fetch("/api/b2b/context", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok || !body.success) throw new Error(body.error ?? "Company account unavailable");
        setContext(body.data as CompanyContext);
      })
      .catch((reason: unknown) => setContextError(reason instanceof Error ? reason.message : "Company account unavailable"));
  }, []);

  const allInCompanyCurrency = useMemo(
    () => Boolean(context) && items.every((item) => item.currency === context!.currency),
    [context, items],
  );
  const displayEstimate = useMemo(() => items.reduce((sum, item) => sum + item.unitPrice * item.qty, 0), [items]);

  async function submit() {
    if (!context || items.length === 0 || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/b2b/purchase-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currency: context.currency,
          items: items.map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.qty,
          })),
          requiredDate: requiredDate || undefined,
          notes: notes.trim() || undefined,
        }),
      });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error ?? "Unable to create purchase order");
      setCreated(body.data.purchaseOrder as CreatedPO);
      clearCart();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to create purchase order");
    } finally {
      setSubmitting(false);
    }
  }

  if (created) {
    return (
      <B2BShell title="Purchase Order Created">
        <div className="mx-auto max-w-xl rounded-2xl border border-border bg-card p-8 text-center">
          <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-success" />
          <h2 className="text-xl font-bold">{created.poNumber}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Server-priced total: {formatCurrency(Number(created.total), created.currency)} · Status: {created.status.replaceAll("_", " ")}
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            Product lines, price tiers and VAT rules were snapshotted for approval. Stock and commercial terms will be checked again before placement.
          </p>
          <a href="/b2b/purchase-orders" className="mt-6 inline-flex h-10 items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground">
            Return to purchase orders
          </a>
        </div>
      </B2BShell>
    );
  }

  return (
    <B2BShell title="Create Purchase Order" description="Build the approval request from actual catalog lines; pricing is resolved by the server.">
      <div className="mb-4">
        <a href="/b2b/purchase-orders" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Purchase orders</a>
      </div>

      {contextError ? (
        <div className="rounded-2xl border border-danger/30 bg-danger/5 p-6 text-sm text-danger">{contextError}</div>
      ) : !context ? (
        <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">Loading company purchasing context…</div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <section className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-border p-5">
              <div><h2 className="font-semibold">Catalog lines</h2><p className="text-xs text-muted-foreground mt-1">Seller, price and eligibility are re-derived from the product record when submitted.</p></div>
              <span className="text-xs text-muted-foreground">{items.length} line{items.length === 1 ? "" : "s"}</span>
            </div>
            {items.length === 0 ? (
              <div className="p-10 text-center">
                <ShoppingCart className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
                <p className="font-semibold">Your cart has no products</p>
                <p className="mt-1 text-sm text-muted-foreground">Add B2B-enabled products before raising a PO.</p>
                <a href="/products?b2b=true" className="mt-4 inline-block text-sm font-semibold text-primary hover:underline">Browse B2B catalog</a>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {items.map((item) => (
                  <div key={item.id} className="grid grid-cols-[1fr_auto] gap-4 p-4">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-sm">{item.nameEn}</p>
                      <p className="mt-1 font-mono text-xs text-muted-foreground">{item.sku}</p>
                      <p className="mt-1 text-xs text-muted-foreground">Displayed cart price: {formatCurrency(item.unitPrice, item.currency)}</p>
                    </div>
                    <div className="text-right">
                      <input aria-label={`Quantity for ${item.sku}`} type="number" min={1} max={100000} value={item.qty} onChange={(event) => updateQty(item.id, Math.max(1, Number(event.target.value) || 1))} className="h-9 w-24 rounded-lg border border-input bg-background px-2 text-right text-sm" />
                      <button type="button" onClick={() => removeItem(item.id)} className="mt-2 block ml-auto text-xs text-muted-foreground hover:text-danger">Remove</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="mb-4 flex items-center gap-2"><Building2 className="h-4 w-4 text-primary" /><h2 className="font-semibold">{context.companyName}</h2></div>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Company currency</dt><dd className="font-mono">{context.currency}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Role</dt><dd>{context.memberRole.replaceAll("_", " ")}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Spend limit</dt><dd>{context.spendLimit == null ? "Policy based" : formatCurrency(context.spendLimit, context.currency)}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Payment terms</dt><dd>{context.paymentTermsDays} days</dd></div>
              </dl>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
              <label className="block text-xs font-semibold">Required by<input value={requiredDate} onChange={(event) => setRequiredDate(event.target.value)} type="date" className="mt-1 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm font-normal" /></label>
              <label className="block text-xs font-semibold">Buyer notes<textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={2000} className="mt-1 min-h-24 w-full rounded-xl border border-input bg-background p-3 text-sm font-normal" placeholder="Delivery instructions, project reference, internal cost center…" /></label>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5">
              {allInCompanyCurrency ? (
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Cart estimate</span><span className="font-mono font-semibold">{formatCurrency(displayEstimate, context.currency)}</span></div>
              ) : (
                <p className="text-xs text-amber-600">Some cart display prices use another currency. No conversion is guessed; the server will resolve the company-currency B2B price.</p>
              )}
              <p className="mt-3 text-xs text-muted-foreground">The authoritative PO total is calculated from current B2B price tiers and VAT. No amount from this browser is accepted as the commercial total.</p>
              {error && <p className="mt-3 rounded-lg bg-danger/10 p-2 text-xs text-danger">{error}</p>}
              <button type="button" disabled={items.length === 0 || submitting} onClick={submit} className="mt-4 h-11 w-full rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                {submitting ? "Creating…" : "Create purchase order"}
              </button>
            </div>
          </aside>
        </div>
      )}
    </B2BShell>
  );
}
