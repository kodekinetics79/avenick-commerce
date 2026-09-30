import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { CheckCircle, Clock, FileText, Inbox, TrendingUp, XCircle } from "lucide-react";
import { SELLER_QUOTE_REVISION_LIMIT } from "@avenick/database";
import { formatCurrency, isRecordId, isSupportedCurrency } from "@avenick/utils";
import { SellerLayout } from "@/components/layout/seller-layout";
import { fetchSellerBackend } from "@/lib/backend";
import { requireSellerPermission } from "@/lib/auth";
import { sellerHasPermission } from "@/lib/seller-permissions";
import { groupAcceptedValueByCurrency } from "./accepted-value";
import {
  Button,
  CellGrid,
  EmptyState,
  LedgerTable,
  PageHeader,
  Stat,
  StatusPill,
  type PillTone,
} from "@avenick/ui";

export async function generateMetadata() {
  const t = await getTranslations("sellerRelations");
  return { title: t("quotes.metaTitle") };
}

const STATUS: Record<string, { tone: PillTone; icon: typeof CheckCircle }> = {
  DRAFT: { tone: "neutral", icon: Clock },
  SUBMITTED: { tone: "warning", icon: Clock },
  SUPERSEDED: { tone: "neutral", icon: Clock },
  ACCEPTED: { tone: "success", icon: CheckCircle },
  REJECTED: { tone: "danger", icon: XCircle },
  WITHDRAWN: { tone: "neutral", icon: XCircle },
  EXPIRED: { tone: "neutral", icon: Clock },
};

const fmt = (date: string | null) => date ? new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

export default async function QuoteHistoryPage({ searchParams }: { searchParams?: { rfq?: string } }) {
  const { membership, userRole } = await requireSellerPermission("rfqs.view");
  const t = await getTranslations("sellerRelations");
  const rfq = searchParams?.rfq;
  const canOpenRfq = sellerHasPermission({ user: { role: userRole }, membership }, "quotes.submit");
  if (rfq && isRecordId(rfq) && canOpenRfq) redirect(`/quotes/submit?rfq=${encodeURIComponent(rfq)}`);

  type QuoteRevisionRow = {
    id: string;
    rfqId: string;
    revision: number;
    status: string;
    currency: string;
    total: string | number;
    validUntil: string;
    submittedAt: string | null;
    rfq: { rfqNumber: string; requiredBy: string | null; company: { nameEn: string } | null };
    _count: { items: number };
  };
  const data = await fetchSellerBackend<{
    seller: { businessNameEn: string; tier: string };
    history: QuoteRevisionRow[];
  }>("/api/seller/rfqs");
  const revisions = data.history;
  const capped = revisions.length >= SELLER_QUOTE_REVISION_LIMIT;
  const accepted = revisions.filter((row) => row.status === "ACCEPTED");
  const decided = revisions.filter((row) => ["ACCEPTED", "REJECTED", "EXPIRED"].includes(row.status));
  const acceptedTotals = groupAcceptedValueByCurrency(accepted.map((row) => ({ currency: row.currency, totalQuoted: row.total })));
  const acceptedValueLabel = acceptedTotals.length === 0
    ? "—"
    : acceptedTotals.map((entry) => isSupportedCurrency(entry.currency)
      ? formatCurrency(entry.total, entry.currency)
      : `${entry.currency} ${entry.total.toFixed(2)}`).join(" · ");
  const winRate = decided.length ? Math.round((accepted.length / decided.length) * 100) : 0;

  return (
    <SellerLayout sellerName={data.seller.businessNameEn} tier={data.seller.tier} permissions={membership.permissions}>
      <div className="space-y-block">
        <PageHeader
          eyebrow={t("quotes.eyebrow")}
          title={t("quotes.title")}
          dateline={capped ? t("quotes.datelineCapped", { limit: String(SELLER_QUOTE_REVISION_LIMIT) }) : t("quotes.datelineAll")}
          actions={<Button variant="secondary" size="sm" asChild><Link href="/messages"><Inbox className="h-3.5 w-3.5" aria-hidden="true" /> {t("quotes.rfqInbox")}</Link></Button>}
        />

        <CellGrid cols={{ base: 2, lg: 4 }}>
          <Stat label={capped ? t("quotes.stats.listedNewest", { limit: String(SELLER_QUOTE_REVISION_LIMIT) }) : t("quotes.stats.totalSubmitted")} value={revisions.length} rank="section" icon={FileText} chip="neutral" />
          <Stat label={t("quotes.stats.accepted")} value={accepted.length} icon={CheckCircle} chip={accepted.length ? "success" : "neutral"} />
          <Stat label={t("quotes.stats.winRate")} value={decided.length ? winRate : "—"} unit={decided.length ? "%" : undefined} icon={TrendingUp} chip="neutral" dateline={decided.length ? t("quotes.stats.winRateBasis", { n: String(decided.length) }) : undefined} deltaWithheld={!decided.length ? t("quotes.stats.noDecisionYet") : undefined} />
          <Stat label={acceptedTotals.length > 1 ? t("quotes.stats.acceptedValueByCurrency") : t("quotes.stats.acceptedValue")} value={acceptedValueLabel} icon={TrendingUp} chip="neutral" dateline={acceptedTotals.length > 1 ? t("quotes.stats.noConversion") : undefined} />
        </CellGrid>

        <LedgerTable
          rows={revisions}
          getRowKey={(row) => row.id}
          stickyHead
          dateline={capped ? t("quotes.tableCapped", { limit: String(SELLER_QUOTE_REVISION_LIMIT) }) : undefined}
          columns={[
            {
              key: "rfqNumber",
              label: t("quotes.columns.rfqNumber"),
              width: "170px",
              render: (row) => <div><span className="u-mono u-meta text-ink-2">{row.rfq.rfqNumber}</span><p className="u-micro text-ink-3">{t("quotes.revision", { revision: row.revision })}</p></div>,
            },
            { key: "buyer", label: t("quotes.columns.buyer"), render: (row) => <span className="block max-w-[220px] truncate">{row.rfq.company?.nameEn ?? t("common.directBuyer")}</span> },
            { key: "items", label: t("quotes.columns.items"), numeric: true, render: (row) => row._count.items },
            {
              key: "total",
              label: t("quotes.columns.quotedTotal"),
              numeric: true,
              render: (row) => isSupportedCurrency(row.currency) ? formatCurrency(Number(row.total), row.currency) : `${row.currency} ${Number(row.total).toFixed(2)}`,
            },
            { key: "validUntil", label: t("quotes.columns.validUntil"), hideOnMobile: true, render: (row) => <span className="u-meta whitespace-nowrap text-ink-2">{fmt(row.validUntil)}</span> },
            { key: "submittedAt", label: t("quotes.columns.submittedAt"), hideOnMobile: true, render: (row) => <span className="u-meta whitespace-nowrap text-ink-2">{fmt(row.submittedAt)}</span> },
            {
              key: "status",
              label: t("quotes.columns.status"),
              align: "end",
              render: (row) => {
                const config = STATUS[row.status] ?? STATUS.SUBMITTED!;
                return <StatusPill tone={config.tone} className="whitespace-nowrap"><config.icon className="h-3 w-3" aria-hidden="true" /> {t(`quoteStatus.${row.status}`)}</StatusPill>;
              },
            },
          ]}
          empty={<EmptyState eyebrow={t("common.nothingRecorded")} headline={t("quotes.empty.headline")} body={t("quotes.empty.body")} action={<Button variant="secondary" size="sm" asChild><Link href="/messages">{t("quotes.empty.action")}</Link></Button>} />}
        />
      </div>
    </SellerLayout>
  );
}
