"use client";

import { useState } from "react";
import { AlertCircle, Send } from "lucide-react";
import {
  Button,
  EmptyState,
  Eyebrow,
  Field,
  Input,
  LedgerTable,
  Meter,
  Num,
  Surface,
  Textarea,
} from "@avenick/ui";
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

  // How much of the quote is written. This is the one thing a supplier wants to
  // know while filling the form, and it is derived from what they have typed —
  // nothing here claims anything the inputs do not already say.
  const pricedCount = items.filter((item) => {
    const p = Number(prices[item.id]);
    return Number.isFinite(p) && p > 0;
  }).length;
  const complete = pricedCount === items.length && items.length > 0;

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
      <LedgerTable
        rows={items}
        getRowKey={(item) => item.id}
        columns={[
          {
            key: "item",
            label: "Item",
            render: (item) => (
              <div className="min-w-0 py-1.5">
                <p className="u-ui font-medium text-ink-1">{item.nameEn}</p>
                {item.notes && <p className="u-meta text-ink-2">{item.notes}</p>}
              </div>
            ),
          },
          { key: "quantity", label: "Qty", numeric: true, width: "80px" },
          {
            key: "unit",
            label: `Unit price (${currency})`,
            numeric: true,
            width: "170px",
            render: (item) => (
              <Input
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                required
                placeholder="0.00"
                value={prices[item.id] ?? ""}
                onChange={(e) => setPrices((prev) => ({ ...prev, [item.id]: e.target.value }))}
                aria-label={`Unit price for ${item.nameEn}`}
                className="text-end"
              />
            ),
          },
          {
            key: "line",
            label: "Line total",
            numeric: true,
            width: "140px",
            render: (item) => {
              const p = Number(prices[item.id]);
              const line = Number.isFinite(p) && p > 0 ? p * item.quantity : null;
              return line !== null ? (
                <span className="text-ink-1">{line.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              ) : (
                <span className="text-ink-3">—</span>
              );
            },
          },
        ]}
        empty={
          // Every list, table and grid in the system passes a real EmptyState —
          // including this one, so a request that arrived with no lines reads as
          // a deliberate blank rather than as a table that failed to render.
          <EmptyState
            eyebrow="Nothing to price"
            headline="This request has no line items."
            body="Nothing can be quoted until the buyer adds at least one line to it."
          />
        }
      />

      <Field label="Notes to the buyer (optional)" htmlFor="quote-notes">
        <Textarea
          id="quote-notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Lead time, delivery terms, validity period, payment terms…"
        />
      </Field>

      {state.error && (
        <Surface role="alert" rung={2} tone="danger" className="flex items-start gap-2 px-3 py-2">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger-ink" aria-hidden="true" />
          <p className="u-ui text-danger-ink">{state.error}</p>
        </Surface>
      )}

      {/* The quote as it currently stands, and the meter is what turns a grid of
          inputs into something that reads as a quote being written.

          Rung 2, not 3. LAW A reads "raised = actionable", and this bar is not
          clickable — the button on it is. Putting the bar itself on rung 3 also
          flattened the primary CTA, which carries elev-3 of its own, against the
          surface it was supposed to stand off. Recessed table well, rung-2
          summary, raised button: the ladder does the separating. */}
      <Surface rung={2} className="flex flex-wrap items-end justify-between gap-4 p-4">
        <div className="min-w-0 flex-1">
          <Eyebrow className="mb-1">Quote total</Eyebrow>
          <Num
            value={total > 0 ? total.toLocaleString(undefined, { minimumFractionDigits: 2 }) : "—"}
            currency={total > 0 ? currency : undefined}
            rank="section"
          />
          <div className="mt-2 max-w-xs">
            <Meter
              value={pricedCount}
              max={items.length}
              tone={complete ? "success" : "neutral"}
              label="Line items priced"
            />
            <p className="u-meta mt-1 text-ink-3">
              {pricedCount} of {items.length} line{items.length === 1 ? "" : "s"} priced
            </p>
          </div>
        </div>

        <Button type="submit" loading={pending}>
          {!pending && <Send className="h-4 w-4" aria-hidden="true" />}
          {pending ? "Submitting…" : "Submit quote"}
        </Button>
      </Surface>
    </form>
  );
}
