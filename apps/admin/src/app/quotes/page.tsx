import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { db, Prisma, RFQStatus } from "@avenick/database";
import { formatCurrency } from "@avenick/utils";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { format } from "date-fns";
import { Quote, CheckCircle, Clock, XCircle, MessageSquare, Ban, CircleOff, FileText, FileQuestion, Search } from "lucide-react";
import {
  PageHeader, CellGrid, LedgerTable, EmptyState, StatusPill, Surface, Num, Button,
  type PillTone,
} from "@avenick/ui";
import { CountStat, MoneyStat } from "@/app/finance/money-figures";
import { FilterTabs, Pager, CONTROL } from "@/components/console/chrome";

export async function generateMetadata() {
  const t = await getTranslations("adminCommerce.quotes");
  return { title: t("meta.title") };
}
export const dynamic = "force-dynamic";

/**
 * A "quote" in this platform is not its own model: it is an RFQRequest that a
 * seller has priced through submitQuote(), which claims the RFQ, stamps
 * totalQuoted and bumps quoteVersion. quoteVersion > 0 is therefore the only
 * exact marker of "a supplier quote exists" — status alone is not, because a
 * quoted RFQ later moves to ACCEPTED / REJECTED / EXPIRED / CANCELLED.
 *
 * There is deliberately no margin column: the platform records what a seller
 * quotes, never what the goods cost the seller, so margin is not derivable and
 * must not be approximated.
 */
const QUOTED: Prisma.RFQRequestWhereInput = { quoteVersion: { gt: 0 } };

/**
 * Nine statuses, four tones. The old map spent seven hues on nine states, which
 * left "under review" (purple) and "negotiating" (orange) looking like different
 * kinds of thing when they are both simply "still open".
 *
 * Only the tone and the icon live here; each label is translated under
 * `adminCommerce.quotes.status`, keyed by the enum value.
 */
const STATUS_CONFIG: Record<RFQStatus, { tone: PillTone; icon: typeof CheckCircle }> = {
  DRAFT:        { tone: "neutral", icon: FileText },
  SUBMITTED:    { tone: "neutral", icon: FileText },
  UNDER_REVIEW: { tone: "neutral", icon: FileText },
  QUOTED:       { tone: "warning", icon: Clock },
  NEGOTIATING:  { tone: "warning", icon: MessageSquare },
  ACCEPTED:     { tone: "success", icon: CheckCircle },
  REJECTED:     { tone: "danger",  icon: XCircle },
  EXPIRED:      { tone: "neutral", icon: CircleOff },
  CANCELLED:    { tone: "neutral", icon: Ban },
};

/** Statuses a quoted RFQ can legitimately sit in, in lifecycle order. */
const CORE_TABS: RFQStatus[] = ["QUOTED", "NEGOTIATING", "ACCEPTED", "REJECTED"];
const CLOSED_TABS: RFQStatus[] = ["EXPIRED", "CANCELLED"];

interface PageProps {
  searchParams: { status?: string; search?: string; page?: string };
}

export default async function QuotesPage({ searchParams }: PageProps) {
  await requireAdminSession();
  const t = await getTranslations("adminCommerce.quotes");

  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  const limit = 25;
  const status = Object.values(RFQStatus).includes(searchParams.status as RFQStatus)
    ? (searchParams.status as RFQStatus)
    : undefined;
  const search = searchParams.search?.trim() || undefined;

  const where: Prisma.RFQRequestWhereInput = {
    ...QUOTED,
    ...(status ? { status } : {}),
    ...(search
      ? {
          OR: [
            { rfqNumber: { contains: search, mode: "insensitive" } },
            { company: { nameEn: { contains: search, mode: "insensitive" } } },
            { seller: { businessNameEn: { contains: search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [quotes, total, statusCounts, acceptedSums] = await Promise.all([
    db.rFQRequest.findMany({
      where,
      // No quotedAt column exists, so updatedAt is the closest true ordering key
      // for "most recent quote activity" — it is labelled as such in the table.
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        company: { select: { nameEn: true } },
        seller: { select: { businessNameEn: true } },
        items: { select: { id: true, nameEn: true, quantity: true, unitQuoted: true } },
        _count: { select: { messages: true } },
      },
    }),
    db.rFQRequest.count({ where }),
    db.rFQRequest.groupBy({ by: ["status"], where: QUOTED, _count: { _all: true } }),
    // Accepted value is summed in the database per currency: the platform holds
    // no FX rates, so quotes in different currencies must never be added up.
    db.rFQRequest.groupBy({
      by: ["currency"],
      where: { ...QUOTED, status: "ACCEPTED" },
      _sum: { totalQuoted: true },
    }),
  ]);

  // RFQRequest.buyerId has no relation — resolve buyer identities in one query.
  const buyerIds = [...new Set(quotes.map((q) => q.buyerId))];
  const buyers = buyerIds.length
    ? await db.user.findMany({
        where: { id: { in: buyerIds } },
        select: { id: true, firstName: true, lastName: true, email: true },
      })
    : [];
  const buyerMap = new Map(buyers.map((b) => [b.id, b]));

  const countFor = (statuses: RFQStatus[]) =>
    statusCounts.filter((c) => statuses.includes(c.status)).reduce((s, c) => s + c._count._all, 0);

  const totalQuotes = statusCounts.reduce((s, c) => s + c._count._all, 0);
  const acceptedCount = countFor(["ACCEPTED"]);
  const rejectedCount = countFor(["REJECTED"]);
  const decidedCount = acceptedCount + rejectedCount;
  const acceptedTotals = acceptedSums
    .filter((s) => s._sum.totalQuoted !== null)
    .map((s) => ({ currency: s.currency, amount: Number(s._sum.totalQuoted) }));

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const filterHref = (params: Record<string, string | undefined>) => {
    const merged = { ...searchParams, page: undefined, ...params };
    const qs = new URLSearchParams(
      Object.entries(merged).filter((e): e is [string, string] => Boolean(e[1])),
    ).toString();
    return qs ? `/quotes?${qs}` : "/quotes";
  };

  const tabs: (RFQStatus | undefined)[] = [
    undefined,
    ...CORE_TABS,
    ...CLOSED_TABS.filter((s) => countFor([s]) > 0),
  ];

  return (
    <AdminLayout>
      <div className="space-y-block">
        <PageHeader
          eyebrow={t("eyebrow")}
          title={t("title")}
          description={t("description")}
          dateline={t("dateline")}
        />

        {totalQuotes === 0 ? (
          <Surface>
            <EmptyState
              eyebrow={t("none.eyebrow")}
              headline={t("none.headline")}
              body={t("none.body")}
              icon={<Quote className="h-3.5 w-3.5" aria-hidden="true" />}
              action={
                <Button variant="secondary" size="sm" asChild>
                  <Link href="/rfqs">
                    <FileQuestion className="h-3.5 w-3.5" aria-hidden="true" /> {t("none.action")}
                  </Link>
                </Button>
              }
            />
          </Surface>
        ) : (
          <>
            <CellGrid cols={{ base: 2, lg: 4 }} density="compact">
              <CountStat label={t("stats.quoted")} value={totalQuotes} rank="section" />
              <CountStat
                label={t("stats.awaiting")}
                value={countFor(["QUOTED", "NEGOTIATING"])}
                tone={countFor(["QUOTED", "NEGOTIATING"]) > 0 ? "warning" : "default"}
              />
              {/* Win rate is only meaningful over decided quotes; with none decided
                  it is undefined and is shown as such rather than as 0%. */}
              <CountStat
                label={t("stats.winRate")}
                value={decidedCount > 0 ? `${Math.round((acceptedCount / decidedCount) * 100)}%` : "—"}
                note={
                  decidedCount > 0
                    ? t("stats.winRateNote", { accepted: String(acceptedCount), decided: String(decidedCount) })
                    : undefined
                }
                dateline={decidedCount > 0 ? undefined : t("stats.winRateDateline")}
              />
              <MoneyStat
                label={t("stats.acceptedValue")}
                lines={acceptedTotals.map((row) => ({
                  currency: row.currency,
                  formatted: formatCurrency(row.amount, row.currency as never),
                }))}
                dateline={
                  acceptedTotals.length > 1 ? t("stats.acceptedMulti") : t("stats.acceptedSingle")
                }
              />
            </CellGrid>

            <div className="flex flex-col gap-2 lg:flex-row lg:items-start">
              <FilterTabs
                label={t("filters.label")}
                className="min-w-0 flex-1"
                tabs={tabs.map((s) => ({
                  href: filterHref({ status: s }),
                  label: s ? t(`status.${s}`) : t("filters.all"),
                  // Counts are platform-wide (they must be, so the zero-quote
                  // empty state stays honest), so they are hidden while a search
                  // narrows the table rather than shown against unrelated rows.
                  count: search ? undefined : s ? countFor([s]) : totalQuotes,
                  active: status === s || (!status && !s),
                }))}
              />

              <form method="get" action="/quotes" role="search" className="relative w-full lg:max-w-xs">
                {status && <input type="hidden" name="status" value={status} />}
                <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden="true" />
                <input
                  data-rung={1}
                  type="search"
                  name="search"
                  defaultValue={search ?? ""}
                  aria-label={t("search.label")}
                  placeholder={t("search.placeholder")}
                  className={`${CONTROL} ps-9`}
                />
              </form>
            </div>

            <LedgerTable
              rows={quotes}
              getRowKey={(q) => q.id}
              stickyHead
              dateline={t("table.dateline")}
              columns={[
                {
                  key: "rfq",
                  label: t("columns.rfq"),
                  render: (q) => (
                    <div className="py-1">
                      <Link
                        href={`/rfqs?search=${encodeURIComponent(q.rfqNumber)}`}
                        className="u-focus u-mono rounded-nested text-meta font-medium text-primary-ink hover:underline"
                      >
                        {q.rfqNumber}
                      </Link>
                      <p className="u-meta mt-0.5 text-ink-3">
                        {t("raised", { date: format(q.createdAt, "MMM d, yyyy") })}
                        {q._count.messages > 0 && (
                          <span className="ms-2 inline-flex items-center gap-1">
                            <MessageSquare className="h-3 w-3" aria-hidden="true" /> {q._count.messages}
                          </span>
                        )}
                      </p>
                    </div>
                  ),
                },
                {
                  key: "buyer",
                  label: t("columns.buyer"),
                  render: (q) => {
                    const buyer = buyerMap.get(q.buyerId);
                    const buyerName = [buyer?.firstName, buyer?.lastName].filter(Boolean).join(" ");
                    return (
                      <div className="min-w-0 py-1">
                        <p className="truncate font-medium text-ink-1">{q.company?.nameEn ?? (buyerName || t("individualBuyer"))}</p>
                        {buyer && <p className="u-meta truncate text-ink-3">{buyer.email}</p>}
                      </div>
                    );
                  },
                },
                {
                  key: "seller",
                  label: t("columns.seller"),
                  hideOnMobile: true,
                  render: (q) => <span className="text-ink-2">{q.seller?.businessNameEn ?? t("unassigned")}</span>,
                },
                {
                  key: "items",
                  label: t("columns.items"),
                  hideOnMobile: true,
                  render: (q) => {
                    const itemSummary = q.items
                      .slice(0, 2)
                      .map((i) => {
                        const unit = i.unitQuoted ? formatCurrency(Number(i.unitQuoted), q.currency as never) : null;
                        return `${i.quantity}× ${i.nameEn}${unit ? ` @ ${unit}` : ""}`;
                      })
                      .join(", ");
                    return (
                      <div className="max-w-xs py-1 text-ink-2">
                        <p className="truncate">{itemSummary || "—"}</p>
                        {q.items.length > 2 && (
                          <p className="u-meta text-ink-3">{t("moreItems", { count: String(q.items.length - 2) })}</p>
                        )}
                      </div>
                    );
                  },
                },
                {
                  key: "totalQuoted",
                  label: t("columns.total"),
                  numeric: true,
                  render: (q) =>
                    q.totalQuoted !== null ? (
                      <Num value={formatCurrency(Number(q.totalQuoted), q.currency as never)} className="whitespace-nowrap" />
                    ) : (
                      <span className="text-ink-3">—</span>
                    ),
                },
                {
                  key: "quoteVersion",
                  label: t("columns.rev"),
                  numeric: true,
                  render: (q) => <span className="text-ink-3">{t("revValue", { version: String(q.quoteVersion) })}</span>,
                },
                {
                  key: "status",
                  label: t("columns.status"),
                  render: (q) => {
                    const cfg = STATUS_CONFIG[q.status];
                    const StatusIcon = cfg.icon;
                    return (
                      <StatusPill tone={cfg.tone}>
                        <StatusIcon className="h-3 w-3" aria-hidden="true" /> {t(`status.${q.status}`)}
                      </StatusPill>
                    );
                  },
                },
                {
                  key: "updatedAt",
                  label: t("columns.updated"),
                  hideOnMobile: true,
                  render: (q) => <span className="whitespace-nowrap text-ink-2">{format(q.updatedAt, "MMM d, yyyy")}</span>,
                },
              ]}
              empty={
                <EmptyState
                  eyebrow={t("empty.eyebrow")}
                  headline={t("empty.headline")}
                  body={t("empty.body")}
                  icon={<FileQuestion className="h-3.5 w-3.5" aria-hidden="true" />}
                  action={
                    <Button variant="secondary" size="sm" asChild>
                      <Link href="/quotes">{t("empty.action")}</Link>
                    </Button>
                  }
                />
              }
              footer={
                <Pager
                  page={page}
                  totalPages={totalPages}
                  hrefFor={(target) => filterHref({ page: String(target), search })}
                  summary={t.rich("footer", {
                    total: String(total),
                    count: total,
                    n: (chunks) => <span className="fig text-ink-2">{chunks}</span>,
                  })}
                />
              }
            />
          </>
        )}
      </div>
    </AdminLayout>
  );
}
