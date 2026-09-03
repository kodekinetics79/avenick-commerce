"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Building2, CheckCircle2, ShoppingCart } from "lucide-react";
import {
  Button,
  Dateline,
  EmptyState,
  Eyebrow,
  Field,
  Num,
  PageHeader,
  StatusPill,
  Surface,
  Textarea,
} from "@avenick/ui";
import { B2BShell } from "@/components/b2b/b2b-shell";
import { Money } from "@/components/b2b/money";
import { TextField } from "@/components/b2b/controls";
import { useCartStore } from "@/stores/cart";
import { formatCurrency, type SupportedCurrency } from "@avenick/utils";
import { storefrontProductHref } from "@/lib/product-card-commerce";

const SUPPORTED_CURRENCIES = new Set<SupportedCurrency>(["AED", "SAR", "QAR", "KWD", "BHD", "OMR", "USD"]);

function formatCartCurrency(amount: number, currency: string) {
  if (SUPPORTED_CURRENCIES.has(currency as SupportedCurrency)) {
    return formatCurrency(amount, currency as SupportedCurrency);
  }
  return `${currency || "UNKNOWN"} ${amount.toFixed(2)}`;
}

type CompanyContext = {
  companyName: string;
  country: string;
  currency: SupportedCurrency;
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
  currency: SupportedCurrency;
};

export default function NewPurchaseOrderPage() {
  const { items, removeItem, clearCart } = useCartStore();
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
  const allB2B = items.length > 0 && items.every((item) => item.channel === "B2B");
  const displayEstimate = useMemo(() => items.reduce((sum, item) => sum + item.unitPrice * item.qty, 0), [items]);

  async function submit() {
    if (!context || items.length === 0 || !allB2B || submitting) return;
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
      <B2BShell>
        <div className="max-w-xl space-y-block">
          <div>
            <Eyebrow className="mb-1 flex items-center gap-1.5 text-success-ink">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> Created
            </Eyebrow>
            <h1 className="u-h1 u-mono text-ink-1">{created.poNumber}</h1>
            <Dateline className="mt-1.5">
              Product lines, price tiers and VAT rules were snapshotted for approval · stock and commercial terms are
              checked again before placement
            </Dateline>
          </div>

          <Surface rung={1} className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Eyebrow>Server-priced total</Eyebrow>
                <div className="mt-1.5">
                  <Money amount={Number(created.total)} currency={created.currency} rank="section" />
                </div>
              </div>
              <StatusPill tone="warning">{created.status.replaceAll("_", " ").toLowerCase()}</StatusPill>
            </div>
          </Surface>

          <Button asChild variant="primary">
            <Link href="/b2b/purchase-orders">Return to purchase orders</Link>
          </Button>
        </div>
      </B2BShell>
    );
  }

  return (
    <B2BShell>
      <PageHeader
        breadcrumbs={[{ label: "Purchase Orders", href: "/b2b/purchase-orders" }, { label: "New" }]}
        eyebrow="Purchase order"
        title="Create a purchase order"
        description="Built from the catalog lines already in your cart. Pricing is resolved by the server."
        linkComponent={Link}
      />

      {contextError ? (
        <Surface rung={2} tone="danger" role="alert" className="p-6">
          <p className="u-ui text-ink-1">{contextError}</p>
        </Surface>
      ) : !context ? (
        <Surface rung={1} className="p-6">
          <p className="u-ui text-ink-2">Loading company purchasing context…</p>
        </Surface>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
          <Surface rung={2} as="section" className="overflow-hidden">
            <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
              <div>
                <h2 className="u-h3 text-ink-1">Catalog lines</h2>
                <Dateline className="mt-0.5">
                  Seller, price and eligibility are re-derived from the product record when submitted
                </Dateline>
              </div>
              <span className="u-meta shrink-0 text-ink-3">
                {items.length} line{items.length === 1 ? "" : "s"}
              </span>
            </div>
            {items.length === 0 ? (
              <EmptyState
                eyebrow="Cart empty"
                headline="There are no products in your cart to raise a PO from."
                body="A purchase order is built from real catalog lines, so the cart has to hold at least one B2B-enabled product first."
                action={
                  <Button asChild variant="secondary" size="sm">
                    <Link href="/products?b2b=true">
                      <ShoppingCart className="h-4 w-4" aria-hidden="true" /> Browse the B2B catalogue
                    </Link>
                  </Button>
                }
              />
            ) : (
              <ul className="border-t border-hairline">
                {items.map((item) => (
                  <li
                    key={item.id}
                    className="grid grid-cols-[1fr_auto] gap-4 border-b border-hairline p-4 last:border-b-0"
                  >
                    <div className="min-w-0">
                      <p className="u-ui truncate font-medium text-ink-1">{item.nameEn}</p>
                      <p className="u-mono u-meta mt-0.5 text-ink-3">{item.sku}</p>
                      <p className="u-meta mt-1 text-ink-2">
                        Displayed cart price: {formatCartCurrency(item.unitPrice, item.currency)}
                      </p>
                    </div>
                    {/* text-end and ms-auto, never text-right and ml-auto: both
                        of those pinned this column to the left edge in Arabic. */}
                    <div className="flex flex-col items-end gap-1 text-end">
                      <Num value={`× ${item.qty}`} />
                      <a
                        href={item.slug ? storefrontProductHref(item.slug, { currency: item.currency, b2b: true, variantId: item.variantId, quantity: item.qty }) : "/products?b2b=true"}
                        className="u-focus u-meta rounded-nested text-primary-ink hover:underline"
                      >
                        Change selection
                      </a>
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        onClick={() => removeItem(item.id)}
                        className="ms-auto hover:text-danger-ink"
                      >
                        Remove
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Surface>

          <aside className="space-y-4">
            {/* Recessed: the company's purchasing terms are the context every
                figure on this page is read against, not something you act on. */}
            <Surface rung={1} className="p-5">
              <div className="mb-4 flex items-center gap-2">
                <Building2 className="h-4 w-4 text-ink-3" aria-hidden="true" />
                <h2 className="u-h3 truncate text-ink-1">{context.companyName}</h2>
              </div>
              <dl className="space-y-2">
                <div className="flex justify-between gap-3">
                  <dt className="u-ui text-ink-2">Company currency</dt>
                  <dd className="u-mono u-ui text-ink-1">{context.currency}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="u-ui text-ink-2">Role</dt>
                  <dd className="u-ui text-ink-1">{context.memberRole.replaceAll("_", " ").toLowerCase()}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="u-ui text-ink-2">Spend limit</dt>
                  <dd className="u-ui text-ink-1">
                    {context.spendLimit == null ? "Policy based" : formatCurrency(context.spendLimit, context.currency)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="u-ui text-ink-2">Payment terms</dt>
                  <dd className="u-ui text-ink-1">
                    {context.paymentTermsDays === 0 ? "Due on issue" : `NET ${context.paymentTermsDays}`}
                  </dd>
                </div>
              </dl>
            </Surface>

            <Surface rung={2} className="p-5">
              {/* Both labels used to wrap their control with no htmlFor, so
                  clicking the label did nothing and neither field had an
                  accessible name. */}
              <Field label="Required by" htmlFor="po-required-date">
                <TextField
                  id="po-required-date"
                  value={requiredDate}
                  onChange={(event) => setRequiredDate(event.target.value)}
                  type="date"
                />
              </Field>
              <Field label="Buyer notes" htmlFor="po-notes">
                <Textarea
                  id="po-notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  maxLength={2000}
                  placeholder="Delivery instructions, project reference, internal cost center…"
                />
              </Field>
            </Surface>

            <Surface rung={2} className="p-5">
              {allInCompanyCurrency ? (
                <div className="flex items-baseline justify-between gap-3">
                  <Eyebrow>Cart estimate</Eyebrow>
                  <Money amount={displayEstimate} currency={context.currency} />
                </div>
              ) : (
                <p className="u-meta text-warning-ink">
                  Some cart display prices use another currency. No conversion is guessed; the server will resolve the
                  company-currency B2B price.
                </p>
              )}
              <Dateline className="mt-3">
                The authoritative PO total is calculated from current B2B price tiers and VAT · no amount from this
                browser is accepted as the commercial total
              </Dateline>
              {error && (
                <p role="alert" className="u-meta mt-3 rounded-nested bg-danger-soft p-2 text-danger-ink">
                  {error}
                </p>
              )}
              {!allB2B && items.length > 0 && (
                <p className="u-meta mt-3 text-danger-ink">
                  Remove B2C or legacy unknown-channel lines before creating a governed purchase order.
                </p>
              )}
              <Button
                type="button"
                variant="primary"
                size="lg"
                className="mt-4 w-full"
                disabled={items.length === 0 || !allB2B}
                loading={submitting}
                onClick={submit}
              >
                {submitting ? "Creating…" : "Create purchase order"}
              </Button>
            </Surface>
          </aside>
        </div>
      )}
    </B2BShell>
  );
}
