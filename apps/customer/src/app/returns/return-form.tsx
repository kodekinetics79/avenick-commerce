"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle2, Send } from "lucide-react";
import { Button, Surface, Textarea } from "@avenick/ui";
import { createReturnRequest, type ReturnActionState } from "./actions";
import {
  IDENTITY_CONTROL_CLASS,
  IDENTITY_LABEL_CLASS,
  IdentitySelect,
} from "../auth/identity-controls";
import { accountCopy, RETURN_REASON_VALUES } from "../account/account-copy";
import type { IdentityLocale } from "../auth/identity-copy";

interface OrderOption {
  id: string;
  orderNumber: string;
  total: number;
  currency: string;
  createdAt: string;
  summary: string;
  items: Array<{ id: string; nameEn: string; quantity: number; total: number }>;
}

/**
 * The return request form.
 *
 * THE REASON VALUES ARE NOT LOCALISED and must not be. `reason` is a free string
 * written to Return.reason and read back by a seller and by an operator, who may
 * be working in the other language; the <option> value stays English and only
 * its label changes. A localised value in a database column is a data defect
 * that looks like a translation.
 *
 * The three copies of a hand-rolled CONTROL_CLASS that used to live in this
 * file, the register form and the support form are now one shared recessed
 * control. Three copies of a control is how a fourth one drifts.
 */
export function ReturnForm({ locale, orders }: { locale: IdentityLocale; orders: OrderOption[] }) {
  const t = accountCopy(locale).returns.form;
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
      <Surface rung={1} tone="success" role="status" className="u-pop flex items-start gap-2.5 p-4">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success-ink" aria-hidden="true" />
        <p className="u-body text-success-ink">{state.message}</p>
      </Surface>
    );
  }

  return (
    <form action={handle} className="space-y-4">
      <IdentitySelect
        id="return-order"
        name="orderId"
        label={t.order}
        required
        value={orderId}
        onChange={(event) => setOrderId(event.target.value)}
      >
        <option value="">{t.orderPlaceholder}</option>
        {orders.map((o) => (
          <option key={o.id} value={o.id}>
            {o.orderNumber} — {o.summary.slice(0, 60)}
          </option>
        ))}
      </IdentitySelect>

      {selectedOrder && (
        <fieldset>
          <legend className={IDENTITY_LABEL_CLASS}>{t.items}</legend>
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
                <label htmlFor={`return-item-${item.id}`} className="u-body min-w-0 flex-1 text-ink-1">
                  {item.nameEn}
                </label>
                <input
                  type="number"
                  name={`quantity:${item.id}`}
                  data-rung={1}
                  min={1}
                  max={item.quantity}
                  defaultValue={1}
                  className={`${IDENTITY_CONTROL_CLASS} w-20 shrink-0 text-end`}
                  style={{ height: "var(--control-h-sm)" }}
                  aria-label={t.quantityFor(item.nameEn)}
                />
              </div>
            ))}
          </Surface>
          <p className="u-meta mt-1.5 text-ink-3">{t.itemsHint}</p>
        </fieldset>
      )}

      <IdentitySelect id="return-reason" name="reason" label={t.reason} required defaultValue="">
        <option value="">{t.reasonPlaceholder}</option>
        {RETURN_REASON_VALUES.map((value) => (
          <option key={value} value={value}>{t.reasonLabels[value] ?? value}</option>
        ))}
      </IdentitySelect>

      <div>
        <label htmlFor="return-notes" className={IDENTITY_LABEL_CLASS}>{t.notes}</label>
        <Textarea
          id="return-notes"
          name="notes"
          rows={3}
          placeholder={t.notesPlaceholder}
        />
        <p className="u-meta mt-1 text-ink-3">{t.optional}</p>
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
          t.submitting
        ) : (
          <>
            {/* The plane points along the reading direction, so it mirrors. */}
            <Send className="h-4 w-4 rtl:-scale-x-100" aria-hidden="true" />
            {t.submit}
          </>
        )}
      </Button>
    </form>
  );
}
