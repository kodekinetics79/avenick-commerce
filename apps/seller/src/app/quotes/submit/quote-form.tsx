"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { AlertCircle, Send } from "lucide-react";
import {
  Button,
  Dateline,
  EmptyState,
  Eyebrow,
  Field,
  Input,
  Meter,
  Num,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Surface,
  Textarea,
} from "@avenick/ui";
import { estimateSellerQuote } from "@/lib/seller-quote-contract";
import { submitQuoteAction, type QuoteActionState } from "../actions";

interface RFQItemView {
  id: string;
  nameEn: string;
  quantity: number;
  notes: string | null;
}

interface ProductOption {
  id: string;
  sku: string;
  nameEn: string;
  variants: Array<{ id: string; sku: string; nameEn: string }>;
}

interface LatestQuoteInput {
  revision: number;
  freightAmount: string | number;
  freightVatRate: string | number;
  validUntil: string;
  leadTimeDays: number;
  paymentTermsDays: number;
  notes: string | null;
  items: Array<{
    rfqItemId: string;
    productId: string;
    variantId: string | null;
    unitPrice: string | number;
    vatRate: string | number;
  }>;
}

type LineDraft = { productId: string; variantId: string; unitPrice: string; vatRate: string };

function dateInputValue(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
}

function newSubmissionKey() {
  return globalThis.crypto?.randomUUID?.() ?? `quote-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function QuoteForm({
  rfqId,
  items,
  currency,
  products,
  latestQuote,
  defaultValidUntil,
}: {
  rfqId: string;
  items: RFQItemView[];
  currency: string;
  products: ProductOption[];
  latestQuote: LatestQuoteInput | null;
  defaultValidUntil: string;
}) {
  const t = useTranslations("sellerRelations");
  const priorByLine = new Map(latestQuote?.items.map((item) => [item.rfqItemId, item]) ?? []);
  const [lines, setLines] = useState<Record<string, LineDraft>>(() => Object.fromEntries(items.map((item) => {
    const prior = priorByLine.get(item.id);
    return [item.id, {
      productId: prior?.productId ?? "",
      variantId: prior?.variantId ?? "",
      unitPrice: prior ? String(prior.unitPrice) : "",
      vatRate: prior ? String(prior.vatRate) : "0",
    }];
  })));
  const [freightAmount, setFreightAmount] = useState(latestQuote ? String(latestQuote.freightAmount) : "0");
  const [freightVatRate, setFreightVatRate] = useState(latestQuote ? String(latestQuote.freightVatRate) : "0");
  const [validUntil, setValidUntil] = useState(latestQuote ? dateInputValue(latestQuote.validUntil) : defaultValidUntil);
  const [leadTimeDays, setLeadTimeDays] = useState(latestQuote ? String(latestQuote.leadTimeDays) : "7");
  const [paymentTermsDays, setPaymentTermsDays] = useState(latestQuote ? String(latestQuote.paymentTermsDays) : "30");
  const [notes, setNotes] = useState(latestQuote?.notes ?? "");
  const [submissionKey] = useState(newSubmissionKey);
  const [state, setState] = useState<QuoteActionState>({});
  const [pending, setPending] = useState(false);

  const selectedProduct = (line: LineDraft) => products.find((product) => product.id === line.productId);
  const validLines = items.flatMap((item) => {
    const line = lines[item.id];
    if (!line) return [];
    const unitPrice = Number(line.unitPrice);
    const rate = Number(line.vatRate);
    const product = selectedProduct(line);
    if (!line.productId || !Number.isFinite(unitPrice) || unitPrice <= 0 || !Number.isFinite(rate) || rate < 0 || rate > 100) return [];
    if (product?.variants.length && !line.variantId) return [];
    return [{ quantity: item.quantity, unitPrice, vatRate: rate }];
  });
  const complete = validLines.length === items.length && items.length > 0;
  const estimate = estimateSellerQuote({
    lines: validLines,
    freightAmount: Number(freightAmount) || 0,
    freightVatRate: Number(freightVatRate) || 0,
  });

  function updateLine(itemId: string, patch: Partial<LineDraft>) {
    setLines((current) => ({ ...current, [itemId]: { ...current[itemId]!, ...patch } }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setState({});
    if (!complete) {
      setState({ error: t("quoteForm.completeEveryLine") });
      return;
    }
    if (!validUntil) {
      setState({ error: t("quoteForm.validityRequired") });
      return;
    }

    const payload = {
      rfqId,
      submissionKey,
      items: items.map((item) => {
        const line = lines[item.id]!;
        return {
          rfqItemId: item.id,
          productId: line.productId,
          variantId: line.variantId || undefined,
          unitPrice: Number(line.unitPrice),
          vatRate: Number(line.vatRate),
        };
      }),
      freightAmount: Number(freightAmount),
      freightVatRate: Number(freightVatRate),
      validUntil: new Date(`${validUntil}T23:59:59.999Z`).toISOString(),
      leadTimeDays: Number(leadTimeDays),
      paymentTermsDays: Number(paymentTermsDays),
      notes: notes.trim() || undefined,
    };

    setPending(true);
    try {
      const formData = new FormData();
      formData.set("payload", JSON.stringify(payload));
      const result = await submitQuoteAction({}, formData);
      if (result?.error) setState(result);
    } catch (error) {
      if (error && typeof error === "object" && "digest" in error && String((error as { digest?: string }).digest).includes("NEXT_REDIRECT")) {
        throw error;
      }
      setState({ error: t("quoteForm.submitFailed") });
    } finally {
      setPending(false);
    }
  }

  if (items.length === 0) {
    return <EmptyState eyebrow={t("quoteForm.empty.eyebrow")} headline={t("quoteForm.empty.headline")} body={t("quoteForm.empty.body")} />;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Surface rung={1} className="divide-y divide-hairline overflow-hidden">
        {items.map((item) => {
          const line = lines[item.id]!;
          const product = selectedProduct(line);
          const unitPrice = Number(line.unitPrice);
          const rate = Number(line.vatRate);
          const lineTotal = Number.isFinite(unitPrice) && unitPrice > 0 && Number.isFinite(rate)
            ? item.quantity * unitPrice * (1 + rate / 100)
            : null;
          return (
            <fieldset key={item.id} className="p-4">
              <legend className="sr-only">{item.nameEn}</legend>
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <p className="u-ui font-medium text-ink-1">{item.nameEn}</p>
                  {item.notes && <p className="u-meta text-ink-2">{item.notes}</p>}
                </div>
                <Dateline>{t("quoteForm.requestedQuantity", { n: String(item.quantity) })}</Dateline>
              </div>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                <Field label={t("quoteForm.productLabel")} htmlFor={`product-${item.id}`} required>
                  <Select value={line.productId || undefined} onValueChange={(productId) => updateLine(item.id, { productId, variantId: "" })}>
                    <SelectTrigger id={`product-${item.id}`} aria-label={t("quoteForm.productFor", { item: item.nameEn })}>
                      <SelectValue placeholder={t("quoteForm.selectProduct")} />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((option) => <SelectItem key={option.id} value={option.id}>{option.nameEn} · {option.sku}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                {product?.variants.length ? (
                  <Field label={t("quoteForm.variantLabel")} htmlFor={`variant-${item.id}`} required>
                    <Select value={line.variantId || undefined} onValueChange={(variantId) => updateLine(item.id, { variantId })}>
                      <SelectTrigger id={`variant-${item.id}`} aria-label={t("quoteForm.variantFor", { item: item.nameEn })}>
                        <SelectValue placeholder={t("quoteForm.selectVariant")} />
                      </SelectTrigger>
                      <SelectContent>
                        {product.variants.map((variant) => <SelectItem key={variant.id} value={variant.id}>{variant.nameEn} · {variant.sku}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                ) : <div />}
                <Field label={t("quoteForm.columns.unitPrice", { currency })} htmlFor={`price-${item.id}`} required>
                  <Input id={`price-${item.id}`} type="number" inputMode="decimal" min="0.0001" step="0.0001" required value={line.unitPrice} onChange={(event) => updateLine(item.id, { unitPrice: event.target.value })} />
                </Field>
                <Field label={t("quoteForm.vatRateLabel")} htmlFor={`vat-${item.id}`} required>
                  <Input id={`vat-${item.id}`} type="number" inputMode="decimal" min="0" max="100" step="0.01" required value={line.vatRate} onChange={(event) => updateLine(item.id, { vatRate: event.target.value })} />
                </Field>
              </div>
              <p className="u-meta mt-2 text-end text-ink-2">{t("quoteForm.estimatedLineTotal")}: {lineTotal === null ? "—" : `${currency} ${lineTotal.toFixed(2)}`}</p>
            </fieldset>
          );
        })}
      </Surface>

      <Surface rung={2} className="p-4">
        <Eyebrow as="h2" className="mb-3">{t("quoteForm.commercialTerms")}</Eyebrow>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label={t("quoteForm.freightAmount", { currency })} htmlFor="quote-freight" required>
            <Input id="quote-freight" type="number" min="0" step="0.01" required value={freightAmount} onChange={(event) => setFreightAmount(event.target.value)} />
          </Field>
          <Field label={t("quoteForm.freightVatRate")} htmlFor="quote-freight-vat" required>
            <Input id="quote-freight-vat" type="number" min="0" max="100" step="0.01" required value={freightVatRate} onChange={(event) => setFreightVatRate(event.target.value)} />
          </Field>
          <Field label={t("quoteForm.validUntil")} htmlFor="quote-valid-until" required>
            <Input id="quote-valid-until" type="date" required value={validUntil} onChange={(event) => setValidUntil(event.target.value)} />
          </Field>
          <Field label={t("quoteForm.leadTimeDays")} htmlFor="quote-lead-time" required>
            <Input id="quote-lead-time" type="number" min="0" max="3650" step="1" required value={leadTimeDays} onChange={(event) => setLeadTimeDays(event.target.value)} />
          </Field>
          <Field label={t("quoteForm.paymentTermsDays")} htmlFor="quote-payment-terms" required>
            <Input id="quote-payment-terms" type="number" min="0" max="3650" step="1" required value={paymentTermsDays} onChange={(event) => setPaymentTermsDays(event.target.value)} />
          </Field>
          <Field label={t("quoteForm.notesLabel")} htmlFor="quote-notes" className="sm:col-span-2 lg:col-span-3">
            <Textarea id="quote-notes" rows={3} maxLength={2000} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder={t("quoteForm.notesPlaceholder")} />
          </Field>
        </div>
      </Surface>

      {state.error && (
        <Surface role="alert" rung={2} tone="danger" className="flex items-start gap-2 px-3 py-2">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger-ink" aria-hidden="true" />
          <p className="u-ui text-danger-ink">{state.error}</p>
        </Surface>
      )}

      <Surface rung={2} className="flex flex-wrap items-end justify-between gap-4 p-4">
        <div className="min-w-0 flex-1">
          <Eyebrow className="mb-1">{t("quoteForm.estimatedTotal")}</Eyebrow>
          <Num value={estimate.total > 0 ? estimate.total.toFixed(2) : "—"} currency={estimate.total > 0 ? currency : undefined} rank="section" />
          <Dateline className="mt-1">{t("quoteForm.estimateBreakdown", {
            subtotal: estimate.subtotal.toFixed(2),
            vat: estimate.vatAmount.toFixed(2),
            freight: (Number(freightAmount) || 0).toFixed(2),
            freightVat: estimate.freightVatAmount.toFixed(2),
          })}</Dateline>
          <div className="mt-2 max-w-xs">
            <Meter value={validLines.length} max={items.length} tone={complete ? "success" : "neutral"} label={t("quoteForm.linesCompleteMeter")} />
            <p className="u-meta mt-1 text-ink-3">{t("quoteForm.linesComplete", { complete: String(validLines.length), count: items.length, n: String(items.length) })}</p>
          </div>
        </div>
        <div className="text-end">
          <Button type="submit" loading={pending} disabled={!complete || products.length === 0}>
            {!pending && <Send className="h-4 w-4" aria-hidden="true" />}
            {pending ? t("quoteForm.submitting") : latestQuote ? t("quoteForm.submitRevision", { revision: latestQuote.revision + 1 }) : t("quoteForm.submit")}
          </Button>
          <p className="u-meta mt-1 max-w-xs text-ink-3">{t("quoteForm.serverCalculationNote")}</p>
        </div>
      </Surface>
    </form>
  );
}
