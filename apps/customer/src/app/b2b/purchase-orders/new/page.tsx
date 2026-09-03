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
import { useB2BT } from "@/components/b2b/use-b2b-t";
import type { B2BKey } from "@/components/b2b/messages";
import { useCartStore } from "@/stores/cart";
import { formatCurrency, type SupportedCurrency } from "@avenick/utils";
import { storefrontProductHref } from "@/lib/product-card-commerce";

const SUPPORTED_CURRENCIES = new Set<SupportedCurrency>(["AED", "SAR", "QAR", "KWD", "BHD", "OMR", "USD"]);

/**
 * The member roles, in the buyer's language.
 *
 * This panel used to print `memberRole.replaceAll("_", " ").toLowerCase()` —
 * "company admin" — which is an English word rendered from a stored enum, and it
 * sat in the terms panel of an otherwise fully Arabic page. The same three roles
 * are already named in the team page's own map; this is that map's other half.
 * An unmapped value falls back to the raw enum rather than to an invented label.
 */
const ROLE_LABEL: Record<string, B2BKey> = {
  COMPANY_ADMIN: "team.role.admin",
  COMPANY_APPROVER: "team.role.approver",
  COMPANY_BUYER: "team.role.buyer",
};

// `unknown` is passed in rather than written here: it is the one user-visible
// word this helper can emit, and an English literal is an English literal even
// on the defensive branch nobody expects to reach.
function formatCartCurrency(amount: number, currency: string, unknown: string) {
  if (SUPPORTED_CURRENCIES.has(currency as SupportedCurrency)) {
    return formatCurrency(amount, currency as SupportedCurrency);
  }
  return `${currency || unknown} ${amount.toFixed(2)}`;
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
  const t = useB2BT();
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
        if (!response.ok || !body.success) throw new Error(body.error ?? "");
        setContext(body.data as CompanyContext);
      })
      // The server's own reason where it gave one; otherwise a translated line,
      // never an English fallback sentence on an Arabic page.
      .catch((reason: unknown) =>
        setContextError(reason instanceof Error && reason.message ? reason.message : t("newPo.unavailable")),
      );
  }, [t]);

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
      if (!response.ok || !body.success) throw new Error(body.error ?? "");
      setCreated(body.data.purchaseOrder as CreatedPO);
      clearCart();
    } catch (reason) {
      setError(reason instanceof Error && reason.message ? reason.message : t("po.error.failed"));
    } finally {
      setSubmitting(false);
    }
  }

  if (created) {
    return (
      <B2BShell workspace={context?.companyName}>
        {/* ══ THE RECEIPT ══════════════════════════════════════════════════
            The one enormous thing here is the server-priced total, because it
            is the figure that was actually committed — not the estimate the
            browser showed a moment ago. Round one set it at 30px beside a
            status pill; it is the whole reason this screen exists. */}
        <div className="max-w-xl space-y-block">
          <div>
            <Eyebrow className="mb-1 flex items-center gap-1.5 text-success-ink">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> {t("newPo.done.eyebrow")}
            </Eyebrow>
            <h1 className="u-h1 u-mono text-ink-1">{created.poNumber}</h1>
            <Dateline className="mt-1.5">{t("newPo.done.basis")}</Dateline>
          </div>

          <Surface rung={1} className="overflow-hidden">
            <div className="u-drawn w-14" data-on="true" aria-hidden="true" />
            <div className="flex items-start justify-between gap-4 p-5">
              <div>
                <Eyebrow>{t("newPo.done.total")}</Eyebrow>
                <div className="mt-1.5">
                  <Money amount={Number(created.total)} currency={created.currency} rank="hero" />
                </div>
              </div>
              <StatusPill tone="warning" className="shrink-0 whitespace-nowrap">
                {t("po.status.pending")}
              </StatusPill>
            </div>
          </Surface>

          <Button asChild variant="primary">
            <Link href="/b2b/purchase-orders">{t("newPo.done.back")}</Link>
          </Button>
        </div>
      </B2BShell>
    );
  }

  return (
    <B2BShell workspace={context?.companyName}>
      <PageHeader
        breadcrumbs={[{ label: t("po.title"), href: "/b2b/purchase-orders" }, { label: t("newPo.breadcrumb") }]}
        eyebrow={t("newPo.eyebrow")}
        title={t("newPo.title")}
        description={t("newPo.description")}
        linkComponent={Link}
      />

      {contextError ? (
        <Surface rung={2} role="alert" data-commit="failed" className="u-commit overflow-hidden border-s-[3px] p-6">
          <p className="u-ui text-ink-1">{contextError}</p>
        </Surface>
      ) : !context ? (
        <Surface rung={1} className="p-6">
          <p className="u-ui text-ink-2">{t("newPo.loading")}</p>
        </Surface>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
          <Surface rung={2} as="section" className="overflow-hidden">
            <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
              <div>
                <h2 className="u-h3 text-ink-1">{t("newPo.lines")}</h2>
                <Dateline className="mt-0.5">{t("newPo.lines.basis")}</Dateline>
              </div>
              <span className="u-meta shrink-0 text-ink-3">
                {t(items.length === 1 ? "newPo.lines.count.one" : "newPo.lines.count.other", { count: items.length })}
              </span>
            </div>
            {items.length === 0 ? (
              <EmptyState
                eyebrow={t("newPo.empty.eyebrow")}
                headline={t("newPo.empty.headline")}
                body={t("newPo.empty.body")}
                action={
                  <Button asChild variant="secondary" size="sm">
                    <Link href="/products?b2b=true">
                      <ShoppingCart className="h-4 w-4" aria-hidden="true" /> {t("newPo.empty.action")}
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
                        {t("newPo.displayedPrice")}: {formatCartCurrency(item.unitPrice, item.currency, t("common.unknown"))}
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
                        {t("newPo.changeSelection")}
                      </a>
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        onClick={() => removeItem(item.id)}
                        className="ms-auto hover:text-danger-ink"
                      >
                        {t("common.remove")}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Surface>

          <aside className="space-y-4">
            {/* Recessed: the company's purchasing terms are the context every
                figure on this page is read against, not something you act on.
                The brass rule across the top is the same mark the masthead
                carries — this panel is the head of a set of terms. */}
            <Surface rung={1} className="overflow-hidden">
              <div className="u-drawn w-14" data-on="true" aria-hidden="true" />
              <div className="p-5">
                <div className="mb-4 flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-ink-3" aria-hidden="true" />
                  <h2 className="u-h3 truncate text-ink-1">{context.companyName}</h2>
                </div>
                <dl className="space-y-2">
                  <div className="flex justify-between gap-3">
                    <dt className="u-ui text-ink-2">{t("newPo.terms.currency")}</dt>
                    <dd className="u-mono u-ui text-ink-1">{context.currency}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="u-ui text-ink-2">{t("newPo.terms.role")}</dt>
                    <dd className="u-ui text-ink-1">
                      {ROLE_LABEL[context.memberRole] ? t(ROLE_LABEL[context.memberRole]!) : context.memberRole}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="u-ui text-ink-2">{t("newPo.terms.spendLimit")}</dt>
                    <dd className="u-ui text-ink-1">
                      {context.spendLimit == null
                        ? t("newPo.terms.policyBased")
                        : formatCurrency(context.spendLimit, context.currency)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="u-ui text-ink-2">{t("newPo.terms.payment")}</dt>
                    <dd className="u-ui text-ink-1">
                      {context.paymentTermsDays === 0
                        ? t("newPo.terms.dueOnIssue")
                        : t("newPo.terms.net", { days: context.paymentTermsDays })}
                    </dd>
                  </div>
                </dl>
              </div>
            </Surface>

            <Surface rung={2} className="p-5">
              {/* Both labels used to wrap their control with no htmlFor, so
                  clicking the label did nothing and neither field had an
                  accessible name. */}
              <Field label={t("newPo.field.requiredBy")} htmlFor="po-required-date">
                <TextField
                  id="po-required-date"
                  value={requiredDate}
                  onChange={(event) => setRequiredDate(event.target.value)}
                  type="date"
                />
              </Field>
              <Field label={t("newPo.field.notes")} htmlFor="po-notes">
                <Textarea
                  id="po-notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  maxLength={2000}
                  placeholder={t("newPo.field.notes.placeholder")}
                />
              </Field>
            </Surface>

            <Surface rung={2} className="p-5">
              {allInCompanyCurrency ? (
                <div className="flex items-baseline justify-between gap-3">
                  <Eyebrow>{t("newPo.estimate")}</Eyebrow>
                  <Money amount={displayEstimate} currency={context.currency} rank="card" />
                </div>
              ) : (
                <p className="u-meta text-warning-ink">{t("newPo.mixedCurrency")}</p>
              )}
              <Dateline className="mt-3">{t("newPo.basis")}</Dateline>
              {error && (
                <p role="alert" className="u-meta mt-3 rounded-nested bg-danger-soft p-2 text-danger-ink">
                  {error}
                </p>
              )}
              {!allB2B && items.length > 0 && (
                <p className="u-meta mt-3 text-danger-ink">{t("newPo.notAllB2B")}</p>
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
                {submitting ? t("newPo.submitting") : t("newPo.submit")}
              </Button>
            </Surface>
          </aside>
        </div>
      )}
    </B2BShell>
  );
}
