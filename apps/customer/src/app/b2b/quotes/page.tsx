import Link from "next/link";
import { redirect } from "next/navigation";
import { Clock, MessageSquareQuote, Plus } from "lucide-react";
import { Button, CellGrid, EmptyState, LedgerTable, Stat, StatusPill } from "@avenick/ui";
import { B2BShell } from "@/components/b2b/b2b-shell";
import { Money } from "@/components/b2b/money";
import { RFQ_STATUS } from "@/components/b2b/rfq-status";
import { toneRule } from "@/components/b2b/rules";
import { getB2B, b2bMetadata } from "@/components/b2b/i18n";
import type { RFQStatus } from "@avenick/database";
import { fetchB2BJson } from "@/lib/b2b";

export async function generateMetadata() {
  return b2bMetadata("quotes.title");
}
export const dynamic = "force-dynamic";

export default async function QuotesPage() {
  type RFQRow = {
    id: string;
    rfqNumber: string;
    status: RFQStatus;
    requiredBy: string | null;
    totalQuoted: string | number | null;
    currency: string;
    createdAt: string;
    items: Array<{ quantity: number; nameEn: string }>;
    seller: { businessNameEn: string } | null;
  };
  let rfqs: RFQRow[];
  try {
    rfqs = await fetchB2BJson<RFQRow[]>("/api/b2b/rfqs");
  } catch {
    redirect("/b2b/register");
  }

  const { t, f } = await getB2B();
  const awaiting = rfqs.filter((r) => ["SUBMITTED", "UNDER_REVIEW"].includes(r.status)).length;
  const quoted = rfqs.filter((r) => ["QUOTED", "NEGOTIATING"].includes(r.status)).length;
  const accepted = rfqs.filter((r) => r.status === "ACCEPTED").length;

  return (
    <B2BShell
      eyebrow={t("quotes.eyebrow")}
      title={t("quotes.title")}
      description={t("quotes.description")}
      // getRFQsForBuyer takes the 50 most recent rows. Every count in the panel
      // below and every row in the table is drawn from that window, so no
      // figure on this page may be described as a lifetime total.
      dateline={t("quotes.basis")}
    >
      <div className="space-y-block">
        {/* "Quotes to review" leads at section rank because it is the only one
            of the four that is a queue of work rather than a count of history. */}
        <CellGrid cols={{ base: 2, lg: 4 }}>
          <Stat
            label={t("quotes.stat.toReview")}
            value={quoted}
            rank="section"
            chip={quoted > 0 ? "warning" : "neutral"}
          />
          <Stat label={t("quotes.stat.awaiting")} value={awaiting} />
          <Stat label={t("quotes.stat.accepted")} value={accepted} chip={accepted > 0 ? "success" : "neutral"} />
          {/* "Listed", not "Total": this is the length of a 50-row window, and
              a company past its fiftieth RFQ would read a cap as a total. */}
          <Stat label={t("quotes.stat.listed")} value={rfqs.length} />
        </CellGrid>

        <LedgerTable
          rows={rfqs}
          getRowKey={(r) => r.id}
          stickyHead
          dateline={t("quotes.table.basis")}
          // WHOSE MOVE IS IT. The status pill already says it in words at the
          // end of a six-column row; the rule says it at the start of the row,
          // where the eye enters. Same three pixels as the approval queue and
          // the dashboard desk, driven by the same tone the pill uses, so the
          // two can never disagree.
          rowProps={(r) => ({ className: toneRule(RFQ_STATUS[r.status].tone) })}
          columns={[
            {
              key: "rfqNumber",
              label: t("quotes.col.rfq"),
              render: (r) => (
                <div className="py-1">
                  <Link
                    href={`/b2b/rfq/${r.id}`}
                    className="u-focus u-mono rounded-nested font-medium text-primary-ink hover:underline"
                  >
                    {r.rfqNumber}
                  </Link>
                  {r.requiredBy && (
                    <p className="u-meta mt-0.5 inline-flex items-center gap-1 text-ink-3">
                      <Clock className="h-3 w-3" aria-hidden="true" />{" "}
                      {t("quotes.needed", { date: f.dateShort(r.requiredBy) })}
                    </p>
                  )}
                </div>
              ),
            },
            {
              key: "items",
              label: t("quotes.col.items"),
              hideOnMobile: true,
              render: (r) => (
                <p className="max-w-xs truncate text-ink-2">
                  {r.items.slice(0, 2).map((i) => `${i.quantity}× ${i.nameEn}`).join(", ")}
                  {r.items.length > 2 ? ` ${t("quotes.moreItems", { count: r.items.length - 2 })}` : ""}
                </p>
              ),
            },
            {
              key: "seller",
              label: t("quotes.col.supplier"),
              hideOnMobile: true,
              render: (r) => (
                <span className={r.seller ? "text-ink-2" : "u-meta text-ink-3"}>
                  {r.seller?.businessNameEn ?? t("quotes.noSupplier")}
                </span>
              ),
            },
            {
              key: "totalQuoted",
              label: t("quotes.col.quotedTotal"),
              numeric: true,
              render: (r) =>
                r.totalQuoted ? (
                  <Money amount={Number(r.totalQuoted)} currency={r.currency} />
                ) : (
                  <span className="u-meta text-ink-3">{t("quotes.notQuoted")}</span>
                ),
            },
            {
              key: "status",
              label: t("common.status"),
              render: (r) => {
                const cfg = RFQ_STATUS[r.status];
                return (
                  <StatusPill tone={cfg.tone} className="whitespace-nowrap">
                    {t(cfg.labelKey)}
                  </StatusPill>
                );
              },
            },
            {
              key: "createdAt",
              label: t("quotes.col.created"),
              align: "end",
              hideOnMobile: true,
              render: (r) => (
                <span className="u-meta whitespace-nowrap text-ink-3">{f.date(r.createdAt)}</span>
              ),
            },
          ]}
          // The one certificate on this page. A company with no request on file
          // is the emptiest surface in the buyer suite, and it is also the one
          // that most needs to explain what an RFQ costs them: nothing.
          empty={
            <EmptyState
              variant="certificate"
              glyph={<MessageSquareQuote />}
              eyebrow={t("quotes.empty.eyebrow")}
              headline={t("quotes.empty.headline")}
              body={t("quotes.empty.body")}
              action={
                <Button asChild variant="primary">
                  <Link href="/b2b/rfq/new">
                    <Plus className="h-4 w-4" aria-hidden="true" /> {t("quotes.empty.action")}
                  </Link>
                </Button>
              }
            />
          }
        />
      </div>
    </B2BShell>
  );
}
