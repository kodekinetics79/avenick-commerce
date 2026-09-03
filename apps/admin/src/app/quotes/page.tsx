import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { db, Prisma, RFQStatus } from "@avenick/database";
import { formatCurrency } from "@avenick/utils";
import Link from "next/link";
import { format } from "date-fns";
import { Quote, CheckCircle, Clock, XCircle, MessageSquare, Ban, CircleOff, FileText, FileQuestion, Search } from "lucide-react";
import {
  PageHeader, CellGrid, LedgerTable, EmptyState, StatusPill, Surface, Num, Button,
  type PillTone,
} from "@avenick/ui";
import { CountStat, MoneyStat } from "@/app/finance/money-figures";
import { FilterTabs, Pager, CONTROL } from "@/app/finance/console-chrome";

export const metadata = { title: "Quotes" };
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
 */
const STATUS_CONFIG: Record<RFQStatus, { label: string; tone: PillTone; icon: typeof CheckCircle }> = {
  DRAFT:        { label: "Draft",         tone: "neutral", icon: FileText },
  SUBMITTED:    { label: "Submitted",     tone: "neutral", icon: FileText },
  UNDER_REVIEW: { label: "Under review",  tone: "neutral", icon: FileText },
  QUOTED:       { label: "Awaiting buyer", tone: "warning", icon: Clock },
  NEGOTIATING:  { label: "Negotiating",   tone: "warning", icon: MessageSquare },
  ACCEPTED:     { label: "Accepted",      tone: "success", icon: CheckCircle },
  REJECTED:     { label: "Rejected",      tone: "danger",  icon: XCircle },
  EXPIRED:      { label: "Expired",       tone: "neutral", icon: CircleOff },
  CANCELLED:    { label: "Cancelled",     tone: "neutral", icon: Ban },
};

/** Statuses a quoted RFQ can legitimately sit in, in lifecycle order. */
const CORE_TABS: RFQStatus[] = ["QUOTED", "NEGOTIATING", "ACCEPTED", "REJECTED"];
const CLOSED_TABS: RFQStatus[] = ["EXPIRED", "CANCELLED"];

interface PageProps {
  searchParams: { status?: string; search?: string; page?: string };
}

export default async function QuotesPage({ searchParams }: PageProps) {
  await requireAdminSession();

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
          eyebrow="B2B trade"
          title="Quotes"
          description="Supplier quotes submitted against marketplace RFQs, live from the RFQ workflow."
          dateline="A quote is an RFQ a seller has priced · there is no margin column, because the platform never records what the goods cost the seller"
        />

        {totalQuotes === 0 ? (
          <Surface>
            <EmptyState
              eyebrow="Nothing recorded"
              headline="No supplier quote has ever been submitted."
              body="A quote appears here the moment a seller prices an open RFQ — that is the only way one is created. Until then there is nothing to report: no accepted value and no win rate can be computed."
              icon={<Quote className="h-3.5 w-3.5" aria-hidden="true" />}
              action={
                <Button variant="secondary" size="sm" asChild>
                  <Link href="/rfqs">
                    <FileQuestion className="h-3.5 w-3.5" aria-hidden="true" /> Open the RFQ register
                  </Link>
                </Button>
              }
            />
          </Surface>
        ) : (
          <>
            <CellGrid cols={{ base: 2, lg: 4 }} density="compact">
              <CountStat label="Quoted RFQs" value={totalQuotes} rank="section" />
              <CountStat
                label="Awaiting buyer decision"
                value={countFor(["QUOTED", "NEGOTIATING"])}
                tone={countFor(["QUOTED", "NEGOTIATING"]) > 0 ? "warning" : "default"}
              />
              {/* Win rate is only meaningful over decided quotes; with none decided
                  it is undefined and is shown as such rather than as 0%. */}
              <CountStat
                label="Win rate"
                value={decidedCount > 0 ? `${Math.round((acceptedCount / decidedCount) * 100)}%` : "—"}
                note={
                  decidedCount > 0
                    ? `${acceptedCount} of ${decidedCount} decided`
                    : undefined
                }
                dateline={decidedCount > 0 ? undefined : "No quote has been decided yet, so a rate cannot be computed"}
              />
              <MoneyStat
                label="Accepted value"
                lines={acceptedTotals.map((t) => ({
                  currency: t.currency,
                  formatted: formatCurrency(t.amount, t.currency as never),
                }))}
                dateline={
                  acceptedTotals.length > 1
                    ? "One line per currency · no conversion applied"
                    : "Total quoted on accepted RFQs, as recorded"
                }
              />
            </CellGrid>

            <div className="flex flex-col gap-2 lg:flex-row lg:items-start">
              <FilterTabs
                label="Filter quotes by status"
                className="min-w-0 flex-1"
                tabs={tabs.map((s) => ({
                  href: filterHref({ status: s }),
                  label: s ? STATUS_CONFIG[s].label : "All",
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
                  aria-label="Search quotes by RFQ number, buyer or supplier"
                  placeholder="RFQ #, buyer or supplier…"
                  className={`${CONTROL} ps-9`}
                />
              </form>
            </div>

            <LedgerTable
              rows={quotes}
              getRowKey={(q) => q.id}
              stickyHead
              dateline="Ordered by most recent quote activity · quoted totals in the currency of the RFQ, no conversion applied"
              columns={[
                {
                  key: "rfq",
                  label: "RFQ",
                  render: (q) => (
                    <div className="py-1">
                      <Link
                        href={`/rfqs?search=${encodeURIComponent(q.rfqNumber)}`}
                        className="u-focus u-mono rounded-nested text-meta font-medium text-primary-ink hover:underline"
                      >
                        {q.rfqNumber}
                      </Link>
                      <p className="u-meta mt-0.5 text-ink-3">
                        Raised {format(q.createdAt, "MMM d, yyyy")}
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
                  label: "Buyer",
                  render: (q) => {
                    const buyer = buyerMap.get(q.buyerId);
                    const buyerName = [buyer?.firstName, buyer?.lastName].filter(Boolean).join(" ");
                    return (
                      <div className="min-w-0 py-1">
                        <p className="truncate font-medium text-ink-1">{q.company?.nameEn ?? (buyerName || "Individual buyer")}</p>
                        {buyer && <p className="u-meta truncate text-ink-3">{buyer.email}</p>}
                      </div>
                    );
                  },
                },
                {
                  key: "seller",
                  label: "Quoting supplier",
                  hideOnMobile: true,
                  render: (q) => <span className="text-ink-2">{q.seller?.businessNameEn ?? "Unassigned"}</span>,
                },
                {
                  key: "items",
                  label: "Quoted items",
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
                        {q.items.length > 2 && <p className="u-meta text-ink-3">+{q.items.length - 2} more</p>}
                      </div>
                    );
                  },
                },
                {
                  key: "totalQuoted",
                  label: "Quoted total",
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
                  label: "Rev",
                  numeric: true,
                  render: (q) => <span className="text-ink-3">v{q.quoteVersion}</span>,
                },
                {
                  key: "status",
                  label: "Status",
                  render: (q) => {
                    const cfg = STATUS_CONFIG[q.status];
                    const StatusIcon = cfg.icon;
                    return (
                      <StatusPill tone={cfg.tone}>
                        <StatusIcon className="h-3 w-3" aria-hidden="true" /> {cfg.label}
                      </StatusPill>
                    );
                  },
                },
                {
                  key: "updatedAt",
                  label: "Last updated",
                  hideOnMobile: true,
                  render: (q) => <span className="whitespace-nowrap text-ink-2">{format(q.updatedAt, "MMM d, yyyy")}</span>,
                },
              ]}
              empty={
                <EmptyState
                  eyebrow="Nothing matches"
                  headline="No quote matches the current filters."
                  body="Clear the status filter or the search to see every quote on record."
                  icon={<FileQuestion className="h-3.5 w-3.5" aria-hidden="true" />}
                  action={
                    <Button variant="secondary" size="sm" asChild>
                      <Link href="/quotes">Show every quote</Link>
                    </Button>
                  }
                />
              }
              footer={
                <Pager
                  page={page}
                  totalPages={totalPages}
                  hrefFor={(target) => filterHref({ page: String(target), search })}
                  summary={
                    <>
                      <span className="fig text-ink-2">{total}</span> quote{total === 1 ? "" : "s"} in the current filter
                    </>
                  }
                />
              }
            />
          </>
        )}
      </div>
    </AdminLayout>
  );
}
