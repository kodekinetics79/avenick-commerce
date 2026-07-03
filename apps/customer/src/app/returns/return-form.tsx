"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle2, Send } from "lucide-react";
import { Textarea } from "@avenick/ui";
import { createReturnRequest, type ReturnActionState } from "./actions";

const RETURN_REASONS = [
  "Wrong item received",
  "Item damaged / defective",
  "Item not as described",
  "Changed my mind",
  "Order arrived too late",
  "Missing parts / accessories",
  "Other",
];

interface OrderOption {
  id: string;
  orderNumber: string;
  total: number;
  currency: string;
  createdAt: string;
  summary: string;
}

export function ReturnForm({ orders }: { orders: OrderOption[] }) {
  const [state, setState] = useState<ReturnActionState>({});
  const [pending, setPending] = useState(false);

  async function handle(formData: FormData) {
    setPending(true);
    try {
      setState((await createReturnRequest(state, formData)) ?? {});
    } finally {
      setPending(false);
    }
  }

  if (state.ok) {
    return (
      <div className="flex items-start gap-2 rounded-xl bg-green-50 border border-green-200 p-4 text-sm text-green-800">
        <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
        <p>{state.message}</p>
      </div>
    );
  }

  return (
    <form action={handle} className="space-y-4">
      <div>
        <label htmlFor="return-order" className="block text-sm font-medium mb-1">Order</label>
        <select
          id="return-order"
          name="orderId"
          required
          className="w-full h-10 px-3 text-sm border border-border rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">Select a delivered order…</option>
          {orders.map((o) => (
            <option key={o.id} value={o.id}>
              {o.orderNumber} — {o.summary.slice(0, 60)}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="return-reason" className="block text-sm font-medium mb-1">Reason</label>
        <select
          id="return-reason"
          name="reason"
          required
          className="w-full h-10 px-3 text-sm border border-border rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">Select a reason…</option>
          {RETURN_REASONS.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="return-notes" className="block text-sm font-medium mb-1">Details (optional)</label>
        <Textarea id="return-notes" name="notes" rows={3} placeholder="Tell us more — which items, what happened, photos to follow…" />
      </div>

      {state.error && (
        <p className="flex items-center gap-1.5 text-sm text-red-600">
          <AlertCircle className="h-4 w-4 shrink-0" /> {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors disabled:opacity-50"
      >
        <Send className="h-4 w-4" /> {pending ? "Submitting…" : "Submit return request"}
      </button>
    </form>
  );
}
