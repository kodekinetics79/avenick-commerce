"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle2, Send } from "lucide-react";
import { Button, Surface, Textarea } from "@avenick/ui";
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

/**
 * A native <select> dressed as the system's recessed rung-1 control, so it sits
 * at the same depth and height as the Textarea beside it. See the same recipe in
 * the register and support forms; it wants to become a packages/ui primitive.
 *
 * The focus ring is the .u-focus utility rather than a hand-written shadow-[...]
 * value: a page may not spell out a box-shadow of its own, or the five-rung
 * ladder quietly grows a sixth step.
 */
const CONTROL_CLASS =
  "u-focus w-full border border-input bg-surface-1 px-3 text-ui text-ink-1 outline-none " +
  "transition-[border-color,box-shadow] duration-press ease-standard";

const LABEL_CLASS = "u-ui mb-1.5 block font-medium text-ink-1";

interface OrderOption {
  id: string;
  orderNumber: string;
  total: number;
  currency: string;
  createdAt: string;
  summary: string;
  items: Array<{ id: string; nameEn: string; quantity: number; total: number }>;
}

export function ReturnForm({ orders }: { orders: OrderOption[] }) {
  const [state, setState] = useState<ReturnActionState>({});
  const [pending, setPending] = useState(false);
  const [orderId, setOrderId] = useState("");
  const selectedOrder = orders.find((order) => order.id === orderId);

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
      <Surface rung={1} tone="success" role="status" className="flex items-start gap-2.5 p-4">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success-ink" aria-hidden="true" />
        <p className="u-ui text-success-ink">{state.message}</p>
      </Surface>
    );
  }

  return (
    <form action={handle} className="space-y-4">
      <div>
        <label htmlFor="return-order" className={LABEL_CLASS}>Order</label>
        <select
          id="return-order"
          name="orderId"
          data-rung={1}
          required
          value={orderId}
          onChange={(event) => setOrderId(event.target.value)}
          className={CONTROL_CLASS}
          style={{ height: "var(--control-h-md)" }}
        >
          <option value="">Select a delivered order…</option>
          {orders.map((o) => (
            <option key={o.id} value={o.id}>
              {o.orderNumber} — {o.summary.slice(0, 60)}
            </option>
          ))}
        </select>
      </div>

      {selectedOrder && (
        <fieldset>
          <legend className={LABEL_CLASS}>Items and quantities</legend>
          {/* One panel with hairline rules between rows, rather than one bordered
              box per item. */}
          <Surface rung={2} className="overflow-hidden">
            {selectedOrder.items.map((item, i) => (
              <div
                key={item.id}
                className={`flex items-center gap-3 p-3 ${i > 0 ? "border-t border-hairline" : ""}`}
              >
                {/* The row used to be one <label> wrapping BOTH the checkbox and
                    the quantity field, so clicking into the quantity toggled the
                    checkbox. The label now covers only what it labels. */}
                <input
                  type="checkbox"
                  id={`return-item-${item.id}`}
                  name="orderItemId"
                  value={item.id}
                  className="u-focus h-4 w-4 shrink-0 rounded-sm accent-primary"
                />
                <label htmlFor={`return-item-${item.id}`} className="u-ui min-w-0 flex-1 text-ink-1">
                  {item.nameEn}
                </label>
                <input
                  type="number"
                  name={`quantity:${item.id}`}
                  data-rung={1}
                  min={1}
                  max={item.quantity}
                  defaultValue={1}
                  className={`${CONTROL_CLASS} w-20 shrink-0 text-end`}
                  style={{ height: "var(--control-h-sm)" }}
                  aria-label={`Return quantity for ${item.nameEn}`}
                />
              </div>
            ))}
          </Surface>
          <p className="u-meta mt-1.5 text-ink-3">
            Tick each item you are returning. The quantity may not exceed what was ordered.
          </p>
        </fieldset>
      )}

      <div>
        <label htmlFor="return-reason" className={LABEL_CLASS}>Reason</label>
        <select
          id="return-reason"
          name="reason"
          data-rung={1}
          required
          className={CONTROL_CLASS}
          style={{ height: "var(--control-h-md)" }}
        >
          <option value="">Select a reason…</option>
          {RETURN_REASONS.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="return-notes" className={LABEL_CLASS}>Details</label>
        <Textarea
          id="return-notes"
          name="notes"
          rows={3}
          placeholder="Which items, what happened, photos to follow…"
        />
        <p className="u-meta mt-1 text-ink-3">Optional.</p>
      </div>

      {/* The slot is always present, so a rejected submission never shoves the
          submit button out from under the pointer. */}
      <div role="alert" className="min-h-[1.5rem]">
        {state.error && (
          <p className="u-meta flex items-center gap-1.5 text-danger-ink">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> {state.error}
          </p>
        )}
      </div>

      <Button type="submit" loading={pending}>
        {pending ? (
          "Submitting…"
        ) : (
          <>
            <Send className="h-4 w-4" aria-hidden="true" />
            Submit return request
          </>
        )}
      </Button>
    </form>
  );
}
