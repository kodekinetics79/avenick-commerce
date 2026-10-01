import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AlertTriangle, CheckCircle2, Clock3, FileCheck2, ShieldCheck, Store } from "lucide-react";
import {
  Button,
  Dateline,
  EmptyState,
  Eyebrow,
  FieldWell,
  LedgerTable,
  Num,
  PageHeader,
  StatusPill,
  Surface,
  TierMark,
  type PillTone,
} from "@avenick/ui";
import type { BuyerRFQDealLedgerDTO } from "@avenick/database";
import { RECORD_ID } from "@avenick/utils";
import { B2BShell } from "@/components/b2b/b2b-shell";
import { Money } from "@/components/b2b/money";
import { RFQ_STATUS } from "@/components/b2b/rfq-status";
import { getB2B, b2bMetadata } from "@/components/b2b/i18n";
import type { B2BKey } from "@/components/b2b/messages";
import { fetchB2BJson } from "@/lib/b2b";
import { AwardQuoteControl } from "./award-quote-control";

export async function generateMetadata() {
  return b2bMetadata("rfq.eyebrow");
}
export const dynamic = "force-dynamic";

const QUOTE_TONE: Record<string, PillTone> = {
  SUBMITTED: "warning",
  ACCEPTED: "success",
  REJECTED: "neutral",
  WITHDRAWN: "neutral",
  EXPIRED: "danger",
  SUPERSEDED: "neutral",
};
const BRASS_TIERS = new Set(["VERIFIED", "GOLD", "PLATINUM"]);
const QUOTE_LABEL: Record<string, B2BKey> = {
  SUBMITTED: "rfq.deal.status.SUBMITTED",
  ACCEPTED: "rfq.deal.status.ACCEPTED",
  REJECTED: "rfq.deal.status.REJECTED",
  WITHDRAWN: "rfq.deal.status.WITHDRAWN",
  EXPIRED: "rfq.deal.status.EXPIRED",
  SUPERSEDED: "rfq.deal.status.SUPERSEDED",
};
const TIER_LABEL: Record<string, B2BKey> = {
  STANDARD: "rfq.tier.standard",
  VERIFIED: "rfq.tier.verified",
  GOLD: "rfq.tier.gold",
  PLATINUM: "rfq.tier.platinum",
};
const AWARD_ERROR_LABEL: Record<string, B2BKey> = {
  expired: "rfq.deal.award.error.expired",
  stale: "rfq.deal.award.error.stale",
  forbidden: "rfq.deal.award.error.forbidden",
  failed: "rfq.deal.award.error.failed",
};

export default async function RFQDealLedgerPage(props: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ award?: string; awardError?: string }>;
}) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  if (!RECORD_ID.test(params.id)) notFound();
  let rfq: BuyerRFQDealLedgerDTO;
  try {
    rfq = await fetchB2BJson<BuyerRFQDealLedgerDTO>(
      `/api/b2b/rfqs/${encodeURIComponent(params.id)}`,
    );
  } catch (error) {
    if (error instanceof Error && /not found/i.test(error.message)) notFound();
    redirect("/b2b/register");
  }

  const { t, f, locale } = await getB2B();
  const cfg = RFQ_STATUS[rfq.status as keyof typeof RFQ_STATUS] ?? RFQ_STATUS.SUBMITTED;
  const currentQuotes = rfq.quotes.filter((quote) =>
    ["SUBMITTED", "ACCEPTED"].includes(quote.status),
  );
  const lowestTotal = currentQuotes.length
    ? Math.min(...currentQuotes.map((quote) => Number(quote.total)))
    : null;
  const acceptedQuote = rfq.quotes.find((quote) => quote.id === rfq.acceptedQuoteId);
  const acceptedPO = acceptedQuote?.purchaseOrder ?? null;
  const awardErrorKey = searchParams?.awardError
    ? (AWARD_ERROR_LABEL[searchParams.awardError] ?? null)
    : null;

  return (
    <B2BShell>
      <div className="max-w-5xl space-y-block">
        <PageHeader
          breadcrumbs={[
            { label: t("rfq.breadcrumb"), href: "/b2b/quotes" },
            { label: rfq.rfqNumber },
          ]}
          eyebrow={t("rfq.deal.eyebrow")}
          title={rfq.rfqNumber}
          description={t("rfq.deal.description")}
          dateline={
            rfq.requiredBy
              ? t("rfq.requiredBy", {
                  date: f.date(rfq.createdAt),
                  required: f.date(rfq.requiredBy),
                })
              : t("rfq.noRequiredBy", { date: f.date(rfq.createdAt) })
          }
          actions={<StatusPill tone={cfg.tone}>{t(cfg.labelKey)}</StatusPill>}
          linkComponent={Link}
        />

        {searchParams?.award === "done" && acceptedPO && (
          <Surface
            rung={2}
            role="status"
            aria-live="polite"
            data-commit="committed"
            className="u-commit u-pop overflow-hidden border-s-[3px] p-4"
          >
            <div className="flex items-start gap-3">
              <CheckCircle2
                className="mt-0.5 h-5 w-5 shrink-0 text-success-ink"
                aria-hidden="true"
              />
              <div>
                <p className="u-ui font-medium text-success-ink">{t("rfq.deal.award.doneTitle")}</p>
                <p className="u-ui mt-1 text-ink-1">
                  {t("rfq.deal.award.doneBody", { po: acceptedPO.poNumber })}
                </p>
                <Dateline className="mt-1">{t("rfq.deal.award.doneBasis")}</Dateline>
                <Button asChild variant="secondary" size="sm" className="mt-3">
                  <Link href="/b2b/purchase-orders">
                    <FileCheck2 className="h-4 w-4" aria-hidden="true" />{" "}
                    {t("rfq.deal.award.viewPo")}
                  </Link>
                </Button>
              </div>
            </div>
          </Surface>
        )}

        {awardErrorKey && (
          <Surface
            rung={2}
            tone="danger"
            role="alert"
            data-commit="failed"
            className="u-commit u-pop overflow-hidden border-s-[3px] p-4"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle
                className="mt-0.5 h-5 w-5 shrink-0 text-danger-ink"
                aria-hidden="true"
              />
              <div>
                <p className="u-ui font-medium text-danger-ink">{t("rfq.deal.award.errorTitle")}</p>
                <p className="u-ui mt-1 text-ink-1">{t(awardErrorKey)}</p>
              </div>
            </div>
          </Surface>
        )}

        {rfq.notes && (
          <FieldWell padded>
            <Eyebrow className="mb-1">{t("rfq.notes")}</Eyebrow>
            <p className="u-body whitespace-pre-line text-ink-1">{rfq.notes}</p>
          </FieldWell>
        )}

        <LedgerTable
          title={t("rfq.deal.requirements")}
          dateline={t("rfq.deal.requirementsBasis")}
          rows={rfq.items}
          getRowKey={(item) => item.id}
          columns={[
            {
              key: "nameEn",
              label: t("rfq.col.item"),
              render: (item) => (
                <div className="py-1">
                  <p className="font-medium text-ink-1">{item.nameEn}</p>
                  {item.notes && <p className="u-meta text-ink-2">{item.notes}</p>}
                </div>
              ),
            },
            {
              key: "quantity",
              label: t("rfq.col.qty"),
              numeric: true,
              render: (item) => <Num value={item.quantity} />,
            },
          ]}
          empty={
            <EmptyState
              eyebrow={t("rfq.items.empty.eyebrow")}
              headline={t("rfq.items.empty.headline")}
              body={t("rfq.items.empty.body")}
            />
          }
        />

        <section aria-labelledby="deal-ledger-title" className="space-y-4">
          <div>
            <Eyebrow>{t("rfq.deal.comparisonEyebrow")}</Eyebrow>
            <h2 id="deal-ledger-title" className="u-h2 mt-1 text-ink-1">
              {t("rfq.deal.comparisonTitle")}
            </h2>
            <Dateline className="mt-1">
              {t("rfq.deal.comparisonBasis", { currency: rfq.currency })}
            </Dateline>
          </div>
          {rfq.quotes.length === 0 && !rfq.legacyQuote ? (
            <EmptyState
              eyebrow={t("rfq.deal.empty.eyebrow")}
              headline={t("rfq.deal.empty.headline")}
              body={t("rfq.deal.empty.body")}
              icon={<Clock3 />}
            />
          ) : (
            <div className="space-y-4">
              {rfq.quotes.map((quote) => {
                const valid = new Date(quote.validUntil).getTime() > Date.now();
                const awardable =
                  quote.status === "SUBMITTED" && valid && !rfq.acceptedQuoteId && rfq.canAward;
                const sellerName =
                  locale === "ar"
                    ? quote.seller.businessNameAr?.trim() || quote.seller.businessNameEn
                    : quote.seller.businessNameEn;
                const lowest =
                  lowestTotal !== null &&
                  Number(quote.total) === lowestTotal &&
                  currentQuotes.length > 1;
                const tierKey = TIER_LABEL[quote.seller.tier] ?? "rfq.tier.standard";
                const quoteLabel = QUOTE_LABEL[quote.status] ?? "rfq.deal.status.SUBMITTED";
                return (
                  <Surface
                    key={quote.id}
                    rung={quote.status === "ACCEPTED" ? 3 : 2}
                    className="overflow-hidden"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-hairline p-5">
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-nested bg-neutral-soft text-ink-2">
                          <Store className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="u-h3 text-ink-1">{sellerName}</h3>
                            <StatusPill tone={QUOTE_TONE[quote.status] ?? "neutral"}>
                              {t(quoteLabel)}
                            </StatusPill>
                            {lowest && (
                              <StatusPill tone="accent">{t("rfq.deal.lowest")}</StatusPill>
                            )}
                          </div>
                          <p className="u-meta mt-1 flex flex-wrap items-center gap-2 text-ink-3">
                            <span>{t("rfq.deal.revision", { revision: quote.revision })}</span>
                            <span>
                              · {quote.seller.city}, {quote.seller.country}
                            </span>
                            {quote.seller.verification ? (
                              <span className="inline-flex items-center gap-1 text-success-ink">
                                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                                {t("rfq.deal.verified", {
                                  type: quote.seller.verification.type,
                                  date: f.date(quote.seller.verification.reviewedAt),
                                })}
                              </span>
                            ) : BRASS_TIERS.has(quote.seller.tier) &&
                              quote.seller.tier !== "VERIFIED" ? (
                              <TierMark tier={quote.seller.tier} label={t(tierKey)} />
                            ) : null}
                          </p>
                        </div>
                      </div>
                      <div className="text-end">
                        <Eyebrow>{t("rfq.deal.grandTotal")}</Eyebrow>
                        <Money
                          amount={Number(quote.total)}
                          currency={quote.currency}
                          rank="section"
                          className="mt-1"
                        />
                      </div>
                    </div>

                    <div className="grid gap-0 border-b border-hairline sm:grid-cols-2 lg:grid-cols-4">
                      {[
                        [t("rfq.deal.net"), quote.subtotal],
                        [t("rfq.deal.vat"), quote.vatAmount],
                        [t("rfq.deal.freight"), quote.freightAmount],
                        [t("rfq.deal.freightVat"), quote.freightVatAmount],
                      ].map(([label, amount]) => (
                        <div
                          key={label}
                          className="border-b border-hairline p-4 last:border-b-0 sm:border-e sm:[&:nth-child(n+3)]:border-b-0"
                        >
                          <Eyebrow>{label}</Eyebrow>
                          <Money
                            amount={Number(amount)}
                            currency={quote.currency}
                            className="mt-1"
                          />
                        </div>
                      ))}
                    </div>

                    <div className="grid gap-3 border-b border-hairline p-5 sm:grid-cols-3">
                      <div>
                        <Eyebrow>{t("rfq.deal.validUntil")}</Eyebrow>
                        <p className={`u-ui mt-1 ${valid ? "text-ink-1" : "text-danger-ink"}`}>
                          {f.dateTime(quote.validUntil)}
                        </p>
                      </div>
                      <div>
                        <Eyebrow>{t("rfq.deal.leadTime")}</Eyebrow>
                        <p className="u-ui mt-1 text-ink-1">
                          {t("rfq.deal.days", { count: quote.leadTimeDays })}
                        </p>
                      </div>
                      <div>
                        <Eyebrow>{t("rfq.deal.paymentTerms")}</Eyebrow>
                        <p className="u-ui mt-1 text-ink-1">
                          {quote.paymentTermsDays === 0
                            ? t("rfq.deal.dueNow")
                            : t("rfq.deal.netDays", { count: quote.paymentTermsDays })}
                        </p>
                      </div>
                    </div>

                    <LedgerTable
                      title={t("rfq.deal.lineDetail")}
                      dateline={t("rfq.deal.lineBasis")}
                      rows={quote.items}
                      getRowKey={(line) => line.id}
                      density="compact"
                      className="rounded-none border-0 shadow-none"
                      columns={[
                        {
                          key: "name",
                          label: t("rfq.col.item"),
                          render: (line) => (
                            <div>
                              <p className="font-medium">{line.nameEn}</p>
                              <p className="u-mono u-meta text-ink-3">{line.sku}</p>
                            </div>
                          ),
                        },
                        {
                          key: "quantity",
                          label: t("rfq.col.qty"),
                          numeric: true,
                          render: (line) => <Num value={line.quantity} />,
                        },
                        {
                          key: "unitPrice",
                          label: t("rfq.deal.unitNet"),
                          numeric: true,
                          render: (line) => (
                            <Money amount={Number(line.unitPrice)} currency={quote.currency} />
                          ),
                        },
                        {
                          key: "vatRate",
                          label: t("rfq.deal.vatRate"),
                          numeric: true,
                          hideOnMobile: true,
                          render: (line) => <Num value={`${line.vatRate}%`} />,
                        },
                        {
                          key: "lineTotal",
                          label: t("rfq.col.lineTotal"),
                          numeric: true,
                          render: (line) => (
                            <Money amount={Number(line.lineTotal)} currency={quote.currency} />
                          ),
                        },
                      ]}
                      empty={
                        <EmptyState
                          eyebrow={t("rfq.items.empty.eyebrow")}
                          headline={t("rfq.items.empty.headline")}
                          body={t("rfq.items.empty.body")}
                        />
                      }
                    />

                    <div className="flex flex-wrap items-center justify-between gap-3 p-5">
                      <div className="min-w-0">
                        {quote.notes && <p className="u-ui text-ink-2">{quote.notes}</p>}
                        {!valid && (
                          <p className="u-meta text-danger-ink">{t("rfq.deal.expired")}</p>
                        )}
                        {!rfq.canAward && quote.status === "SUBMITTED" && (
                          <p className="u-meta text-ink-3">{t("rfq.deal.readOnly")}</p>
                        )}
                      </div>
                      {awardable && (
                        <AwardQuoteControl
                          rfqId={rfq.id}
                          quoteId={quote.id}
                          expectedFingerprint={quote.commercialFingerprint}
                          sellerName={sellerName}
                          total={Number(quote.total)}
                          currency={quote.currency}
                          validUntil={f.dateTime(quote.validUntil)}
                        />
                      )}
                      {quote.purchaseOrder && (
                        <Button asChild variant="secondary" size="sm">
                          <Link href="/b2b/purchase-orders">
                            {t("rfq.deal.poLinked", { po: quote.purchaseOrder.poNumber })}
                          </Link>
                        </Button>
                      )}
                    </div>
                  </Surface>
                );
              })}

              {rfq.legacyQuote && (
                <Surface rung={1} className="p-5">
                  <Eyebrow>{t("rfq.deal.legacy.eyebrow")}</Eyebrow>
                  <h3 className="u-h3 mt-1 text-ink-1">{rfq.legacyQuote.sellerName}</h3>
                  <p className="u-ui mt-2 text-ink-2">{t("rfq.deal.legacy.body")}</p>
                  {rfq.legacyQuote.total && (
                    <Money
                      amount={Number(rfq.legacyQuote.total)}
                      currency={rfq.currency}
                      rank="card"
                      className="mt-3"
                    />
                  )}
                </Surface>
              )}
            </div>
          )}
        </section>
      </div>
    </B2BShell>
  );
}
