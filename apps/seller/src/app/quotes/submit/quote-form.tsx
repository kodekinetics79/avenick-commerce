"use client";

import { useState } from "react";
import { AlertCircle, Send } from "lucide-react";
import { Input, Textarea } from "@avenick/ui";
import { submitQuoteAction, type QuoteActionState } from "../actions";

interface RFQItemView {
  id: string;
  nameEn: string;
  quantity: number;
  notes: string | null;
}

export function QuoteForm({ rfqId, items, currency }: { rfqId: string; items: RFQItemView[]; currency: string }) {
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [state, setState] = useState<QuoteActionState>({});
  const [pending, setPending] = useState(false);

  const total = items.reduce((sum, item) => {
    const p = Number(prices[item.id]);
    return sum + (Number.isFinite(p) && p > 0 ? p * item.quantity : 0);
  }, 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState({});

    const quoted = items
      .map((item) => ({ itemId: item.id, unitQuoted: Number(prices[item.id]) }))
      .filter((q) => Number.isFinite(q.unitQuoted) && q.unitQuoted > 0);
    if (quoted.length !== items.length) {
      setState({ error: "Enter a positive unit price for every line item." });
      return;
    }

    setPending(true);
    try {
      const formData = new FormData();
      formData.set("payload", JSON.stringify({ rfqId, items: quoted, notes: notes.trim() || undefined }));
      const result = await submitQuoteAction({}, formData);
      if (result?.error) setState(result);
    } catch (err) {
      // A successful server action redirect surfaces as a thrown NEXT_REDIRECT.
      if (err && typeof err === "object" && "digest" in err && String((err as { digest?: string }).digest).includes("NEXT_REDIRECT")) {
        throw err;
      }
      setState({ error: "Couldn't submit the quote — please retry." });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50 border-b border-border">
            <tr>
              {["Item", "Qty", `Unit price (${currency})`, "Line total"].map((h) => (
                <th key={h} className="px-3 py-2 text-start text-xs font-semibold text-muted-foreground uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map((item) => {
              const p = Number(prices[item.id]);
              const line = Number.isFinite(p) && p > 0 ? p * item.quantity : null;
              return (
                <tr key={item.id}>
                  <td className="px-3 py-2.5">
                    <p className="font-medium">{item.nameEn}</p>
                    {item.notes && <p className="text-xs text-muted-foreground">{item.notes}</p>}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{item.quantity}</td>
                  <td className="px-3 py-2.5 w-40">
                    <Input
                      type="number"
                      min="0.01"
                      step="0.01"
                      required
                      placeholder="0.00"
                      value={prices[item.id] ?? ""}
                      onChange={(e) => setPrices((prev) => ({ ...prev, [item.id]: e.target.value }))}
                      aria-label={`Unit price for ${item.nameEn}`}
                    />
                  </td>
                  <td className="px-3 py-2.5 font-semibold">
                    {line !== null ? line.toLocaleString(undefined, { minimumFractionDigits: 2 }) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-secondary/50 border-t border-border">
            <tr>
              <td colSpan={3} className="px-3 py-2.5 text-end font-semibold">Quote total</td>
              <td className="px-3 py-2.5 font-bold">
                {total > 0 ? `${total.toLocaleString(undefined, { minimumFractionDigits: 2 })} ${currency}` : "—"}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div>
        <label htmlFor="quote-notes" className="block text-sm font-medium mb-1">Notes to the buyer (optional)</label>
        <Textarea
          id="quote-notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Lead time, delivery terms, validity period, payment terms…"
        />
      </div>

      {state.error && (
        <p className="flex items-center gap-1.5 text-sm text-danger">
          <AlertCircle className="h-4 w-4 shrink-0" /> {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
      >
        <Send className="h-4 w-4" /> {pending ? "Submitting…" : "Submit quote"}
      </button>
    </form>
  );
}
