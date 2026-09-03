"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle, Send, Plus, Trash2, AlertCircle, Building2 } from "lucide-react";
import { B2BShell } from "@/components/b2b/b2b-shell";
import { Button, Input, Textarea } from "@avenick/ui";
import { submitRFQ } from "../actions";

type Priority = "NORMAL" | "URGENT" | "CRITICAL";

interface RFQItem {
  id: string;
  description: string;
  quantity: string;
  unit: string;
  targetPrice: string;
  specs: string;
}

export interface RFQCategoryOption {
  slug: string;
  label: string;
}

/**
 * Priority is recorded in the RFQ notes for the assigned supplier to read.
 * Nothing routes or times an RFQ by priority, so the descriptions describe
 * what the buyer is telling the supplier — not a response window.
 */
const PRIORITY_CONFIG: Record<Priority, { label: string; color: string; desc: string }> = {
  NORMAL:   { label: "Normal",   color: "border-border",       desc: "Routine purchase" },
  URGENT:   { label: "Urgent",   color: "border-amber-400",    desc: "Needed soon — flagged to the supplier" },
  CRITICAL: { label: "Critical", color: "border-red-500",      desc: "Blocking — flagged to the supplier" },
};

export function NewRFQForm({
  categories,
  currency,
}: {
  /** Catalog categories loaded by the server page; empty when none could be loaded. */
  categories: RFQCategoryOption[];
  /** The buyer's company currency, or null when the viewer has no company context. */
  currency: string | null;
}) {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [priority, setPriority] = useState<Priority>("NORMAL");
  const [items, setItems] = useState<RFQItem[]>([
    { id: "1", description: "", quantity: "", unit: "pcs", targetPrice: "", specs: "" },
  ]);

  function addItem() {
    setItems((prev) => [...prev, { id: String(Date.now()), description: "", quantity: "", unit: "pcs", targetPrice: "", specs: "" }]);
  }

  function removeItem(id: string) {
    if (items.length === 1) return;
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  function updateItem(id: string, field: keyof RFQItem, value: string) {
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, [field]: value } : i));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const form = new FormData(e.currentTarget);
    const title = String(form.get("title") ?? "").trim();
    const category = String(form.get("category") ?? "").trim();
    const requiredBy = String(form.get("requiredBy") ?? "").trim();
    const city = String(form.get("city") ?? "").trim();
    const extraNotes = String(form.get("notes") ?? "").trim();

    const validItems = items.filter((i) => i.description.trim() && Number(i.quantity) > 0);
    if (validItems.length === 0) {
      setError("Add at least one item with a description and quantity.");
      return;
    }

    const payload = {
      notes:
        [
          title && `Subject: ${title}`,
          category && `Category: ${category}`,
          city && `Delivery: ${city}`,
          `Priority: ${priority}`,
          extraNotes,
        ]
          .filter(Boolean)
          .join(" · ") || undefined,
      requiredBy: requiredBy || undefined,
      items: validItems.map((i) => ({
        nameEn: i.description.trim(),
        quantity: Number(i.quantity),
        // The target price carries the buyer's company currency; a target with
        // no known currency is recorded per unit only rather than labelled
        // with a currency the buyer never chose.
        notes:
          [
            i.specs.trim(),
            i.targetPrice.trim() && `Target: ${i.targetPrice}${currency ? ` ${currency}` : ""}/${i.unit}`,
          ]
            .filter(Boolean)
            .join(" · ") || undefined,
      })),
    };

    setLoading(true);
    try {
      const actionData = new FormData();
      actionData.set("payload", JSON.stringify(payload));
      // On success the server action redirects to the new RFQ's detail page.
      const result = await submitRFQ({}, actionData);
      if (result?.error) setError(result.error);
      else setSubmitted(true);
    } catch (err) {
      // Next.js signals a successful server-action redirect by throwing.
      if (err && typeof err === "object" && "digest" in err && String((err as { digest?: string }).digest).includes("NEXT_REDIRECT")) {
        throw err;
      }
      setError("Couldn't submit the RFQ — please retry.");
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <B2BShell>
        <div className="bg-slate-50 min-h-screen">
          <div className="max-w-lg mx-auto px-4 py-20 text-center">
            <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-5">
              <CheckCircle className="h-10 w-10 text-primary" />
            </div>
            <h1 className="text-2xl font-bold mb-2">RFQ Submitted!</h1>
            <p className="text-muted-foreground mb-1">Your Request for Quotation has been recorded.</p>
            <p className="text-sm text-muted-foreground mb-6">Response times are not guaranteed. Track this RFQ from your quotes list.</p>
            <div className="bg-white border border-border rounded-2xl p-4 mb-6 text-sm text-start">
              {/* Steps describe the implemented single-supplier RFQ flow. Automatic
                  distribution to matching suppliers and side-by-side comparison are
                  not implemented — an RFQ carries at most one supplier. */}
              <p className="font-semibold mb-2">What happens next?</p>
              <ol className="space-y-1.5 text-muted-foreground">
                <li className="flex items-start gap-2"><span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">1</span> RFQ recorded against your company</li>
                <li className="flex items-start gap-2"><span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">2</span> A supplier is assigned to the request</li>
                <li className="flex items-start gap-2"><span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">3</span> You review the quote when it is submitted</li>
                <li className="flex items-start gap-2"><span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">4</span> Accept the quote → convert to order</li>
              </ol>
            </div>
            <div className="flex gap-3 justify-center">
              <Button asChild variant="primary"><Link href="/b2b">Back to Dashboard</Link></Button>
              <Button asChild variant="ghost"><Link href="/b2b/quotes">View Quotes</Link></Button>
            </div>
          </div>
        </div>
      </B2BShell>
    );
  }

  return (
    <B2BShell>
      <div className="bg-slate-50 min-h-screen">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <Link href="/b2b" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back to B2B Dashboard
          </Link>

          <div className="mb-6">
            <h1 className="text-2xl font-bold">Create Request for Quotation</h1>
            <p className="text-muted-foreground text-sm mt-1">Submit an RFQ to request a supplier quote.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Header info */}
            <div className="bg-white rounded-2xl border border-border p-5">
              <h2 className="font-semibold mb-4 flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary/100" /> RFQ Details
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium mb-1">RFQ Title / Subject <span className="text-red-500">*</span></label>
                  <Input name="title" placeholder="e.g. Safety equipment for a construction site" required />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Category <span className="text-red-500">*</span></label>
                  {/* Options are the catalog's own categories. When none loaded,
                      the buyer types one — the category is free text in the RFQ
                      notes either way, so no list is invented here. */}
                  {categories.length > 0 ? (
                    <select name="category" aria-label="Category" required className="w-full h-10 px-3 text-sm border border-border rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-primary">
                      <option value="">Select category...</option>
                      {categories.map((c) => <option key={c.slug} value={c.label}>{c.label}</option>)}
                      <option value="Other">Other</option>
                    </select>
                  ) : (
                    <Input name="category" placeholder="e.g. Safety & PPE" required />
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Required By <span className="text-red-500">*</span></label>
                  <Input name="requiredBy" type="date" required />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Delivery City</label>
                  <Input name="city" placeholder="City, country" />
                </div>
                {/* No "Preferred supplier" field: the RFQ API accepts none, so an
                    input here would silently discard what the buyer typed. */}
              </div>
            </div>

            {/* Priority */}
            <div className="bg-white rounded-2xl border border-border p-5">
              <h2 className="font-semibold mb-3">Priority</h2>
              <div className="grid grid-cols-3 gap-3">
                {(Object.entries(PRIORITY_CONFIG) as [Priority, typeof PRIORITY_CONFIG[Priority]][]).map(([key, cfg]) => (
                  <button key={key} type="button" onClick={() => setPriority(key)}
                    className={`text-start p-3 rounded-xl border-2 transition-all ${priority === key ? `${cfg.color} bg-primary/10` : "border-border hover:border-slate-300"}`}>
                    <p className="font-semibold text-sm">{cfg.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{cfg.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Line items */}
            <div className="bg-white rounded-2xl border border-border p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold">Line Items</h2>
                <button type="button" onClick={addItem}
                  className="flex items-center gap-1.5 text-sm text-primary hover:text-primary font-medium border border-primary/30 px-3 py-1.5 rounded-lg hover:bg-primary/10 transition-colors">
                  <Plus className="h-3.5 w-3.5" /> Add Item
                </button>
              </div>
              <div className="space-y-4">
                {items.map((item, idx) => (
                  <div key={item.id} className="border border-border rounded-xl p-4 relative">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Item {idx + 1}</span>
                      {items.length > 1 && (
                        <button type="button" aria-label="Remove item" onClick={() => removeItem(item.id)} className="text-muted-foreground hover:text-red-500 transition-colors p-1">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-medium mb-1">Description <span className="text-red-500">*</span></label>
                        <Input value={item.description} onChange={(e) => updateItem(item.id, "description", e.target.value)} placeholder="e.g. Safety Helmet EN397, Hard Shell, Various Sizes" required />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">Quantity <span className="text-red-500">*</span></label>
                        <Input type="number" value={item.quantity} onChange={(e) => updateItem(item.id, "quantity", e.target.value)} placeholder="100" min={1} required />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">Unit</label>
                        <select aria-label="Unit" value={item.unit} onChange={(e) => updateItem(item.id, "unit", e.target.value)}
                          className="w-full h-10 px-3 text-sm border border-border rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-primary">
                          {["pcs", "boxes", "kg", "liters", "sets", "meters", "bags", "pallets"].map(u => <option key={u}>{u}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">Target Unit Price{currency ? ` (${currency})` : ""}</label>
                        <Input type="number" value={item.targetPrice} onChange={(e) => updateItem(item.id, "targetPrice", e.target.value)} placeholder="0.00" min={0} step="0.01" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">Specifications</label>
                        <Input value={item.specs} onChange={(e) => updateItem(item.id, "specs", e.target.value)} placeholder="Brand, certifications, color..." />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Additional notes — no attachment control: RFQs carry no documents,
                and a "coming soon" button is a promise, not a feature. */}
            <div className="bg-white rounded-2xl border border-border p-5">
              <h2 className="font-semibold mb-3">Additional Notes</h2>
              <Textarea name="notes" placeholder="Any special delivery requirements, packaging instructions, compliance certifications (e.g. SASO, Halal), payment preference, etc." rows={3} />
            </div>

            {/* Info callout */}
            <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-primary">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <p>Your RFQ is recorded against your company and tracked in your quotes list. No review or response time is guaranteed.</p>
            </div>

            {error && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <p>{error}</p>
              </div>
            )}

            <Button type="submit" variant="primary" size="lg" className="w-full" loading={loading}>
              <Send className="h-4 w-4 me-2" />
              Submit RFQ
            </Button>
          </form>
        </div>
      </div>
    </B2BShell>
  );
}
