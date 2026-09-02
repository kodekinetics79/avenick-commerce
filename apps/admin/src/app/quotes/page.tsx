import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { db, Prisma, RFQStatus } from "@avenick/database";
import { formatCurrency } from "@avenick/utils";
import Link from "next/link";
import { format } from "date-fns";
import { Quote, CheckCircle, Clock, XCircle, MessageSquare, Ban, CircleOff, FileText, FileQuestion, Search } from "lucide-react";

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

const STATUS_CONFIG: Record<RFQStatus, { label: string; color: string; icon: typeof CheckCircle }> = {
  DRAFT:        { label: "Draft",       color: "bg-slate-500/10 text-muted-foreground",             icon: FileText },
  SUBMITTED:    { label: "Submitted",   color: "bg-blue-500/10 text-blue-700 dark:text-blue-400",   icon: FileText },
  UNDER_REVIEW: { label: "Under review", color: "bg-purple-500/10 text-purple-700 dark:text-purple-400", icon: FileText },
  QUOTED:       { label: "Awaiting buyer", color: "bg-amber-500/10 text-amber-700 dark:text-amber-400", icon: Clock },
  NEGOTIATING:  { label: "Negotiating", color: "bg-orange-500/10 text-orange-700 dark:text-orange-400", icon: MessageSquare },
  ACCEPTED:     { label: "Accepted",    color: "bg-green-500/10 text-green-700 dark:text-green-400", icon: CheckCircle },
  REJECTED:     { label: "Rejected",    color: "bg-red-500/10 text-red-700 dark:text-red-400",       icon: XCircle },
  EXPIRED:      { label: "Expired",     color: "bg-slate-500/10 text-muted-foreground",              icon: CircleOff },
  CANCELLED:    { label: "Cancelled",   color: "bg-slate-500/10 text-muted-foreground",              icon: Ban },
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
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Quotes</h1>
          <p className="text-sm text-muted-foreground">
            Supplier quotes submitted against marketplace RFQs, live from the RFQ workflow.
          </p>
        </div>

        {totalQuotes === 0 ? (
          <section className="rounded-2xl border border-border bg-card p-8 text-center shadow-card">
            <Quote className="mx-auto h-9 w-9 text-muted-foreground/50" />
            <h2 className="mt-4 text-lg font-semibold">No supplier quotes have been submitted yet</h2>
            <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground">
              A quote appears here the moment a seller prices an open RFQ — that is the only way one is created.
              No quote has been submitted on this environment, so there is nothing to report: no accepted value and
              no win rate can be computed yet.
            </p>
            <Link
              href="/rfqs"
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs font-medium hover:bg-secondary"
            >
              <FileQuestion className="h-3.5 w-3.5" /> Open the RFQ register
            </Link>
          </section>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-2xl border border-border bg-card p-4">
                <p className="text-xl font-bold text-foreground">{totalQuotes}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Quoted RFQs</p>
              </div>
              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
                <p className="text-xl font-bold text-amber-600 dark:text-amber-400">
                  {countFor(["QUOTED", "NEGOTIATING"])}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Awaiting buyer decision</p>
              </div>
              <div className="rounded-2xl border border-green-500/20 bg-green-500/10 p-4">
                {/* Win rate is only meaningful over decided quotes; with none decided
                    it is undefined and is shown as such rather than as 0%. */}
                <p className="text-xl font-bold text-green-600 dark:text-green-400">
                  {decidedCount > 0 ? `${Math.round((acceptedCount / decidedCount) * 100)}%` : "—"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {decidedCount > 0
                    ? `Win rate · ${acceptedCount} of ${decidedCount} decided`
                    : "Win rate · none decided yet"}
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-4">
                {acceptedTotals.length === 0 ? (
                  <p className="text-xl font-bold text-muted-foreground">—</p>
                ) : (
                  <div className="flex flex-col gap-0.5">
                    {acceptedTotals.map((t) => (
                      <p key={t.currency} className="text-xl font-bold text-green-700 dark:text-green-400">
                        {formatCurrency(t.amount, t.currency as never)}
                      </p>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-0.5">
                  Accepted value{acceptedTotals.length > 1 ? " · per currency, not converted" : ""}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {tabs.map((s) => {
                const active = status === s || (!status && !s);
                const count = s ? countFor([s]) : totalQuotes;
                return (
                  <Link
                    key={s ?? "all"}
                    href={filterHref({ status: s })}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                      active
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
                    }`}
                  >
                    {/* Counts are platform-wide (they must be, so the zero-quote
                        empty state stays honest), so they are hidden while a search
                        narrows the table rather than shown against unrelated rows. */}
                    {s ? STATUS_CONFIG[s].label : "All"}{search ? "" : ` (${count})`}
                  </Link>
                );
              })}
            </div>

            <form method="get" action="/quotes" className="relative max-w-sm">
              {status && <input type="hidden" name="status" value={status} />}
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="search"
                name="search"
                defaultValue={search ?? ""}
                placeholder="Search by RFQ #, buyer or supplier…"
                className="w-full ps-9 pe-3 py-2 text-sm rounded-xl border border-border bg-card focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </form>

            <div className="bg-card rounded-2xl border border-border shadow-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/50 border-b border-border">
                    <tr>
                      {["RFQ", "Buyer", "Quoting supplier", "Quoted items", "Quoted total", "Rev", "Status", "Last updated"].map((h) => (
                        <th key={h} className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {quotes.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-4 py-12 text-center">
                          <FileQuestion className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                          <p className="text-sm text-muted-foreground">No quotes match the current filters.</p>
                        </td>
                      </tr>
                    )}
                    {quotes.map((q) => {
                      const cfg = STATUS_CONFIG[q.status];
                      const StatusIcon = cfg.icon;
                      const buyer = buyerMap.get(q.buyerId);
                      const buyerName = [buyer?.firstName, buyer?.lastName].filter(Boolean).join(" ");
                      const itemSummary = q.items
                        .slice(0, 2)
                        .map((i) => {
                          const unit = i.unitQuoted ? formatCurrency(Number(i.unitQuoted), q.currency as never) : null;
                          return `${i.quantity}× ${i.nameEn}${unit ? ` @ ${unit}` : ""}`;
                        })
                        .join(", ");
                      return (
                        <tr key={q.id} className="hover:bg-secondary/40 transition-colors">
                          <td className="px-4 py-3">
                            <Link href={`/rfqs?search=${encodeURIComponent(q.rfqNumber)}`} className="font-mono text-xs font-semibold text-primary hover:underline">
                              {q.rfqNumber}
                            </Link>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              Raised {format(q.createdAt, "MMM d, yyyy")}
                              {q._count.messages > 0 && (
                                <span className="ms-2 inline-flex items-center gap-1">
                                  <MessageSquare className="h-3 w-3" /> {q._count.messages}
                                </span>
                              )}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-medium">{q.company?.nameEn ?? (buyerName || "Individual buyer")}</p>
                            {buyer && <p className="text-xs text-muted-foreground">{buyer.email}</p>}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{q.seller?.businessNameEn ?? "Unassigned"}</td>
                          <td className="px-4 py-3 text-muted-foreground max-w-xs">
                            <p className="truncate">{itemSummary || "—"}</p>
                            {q.items.length > 2 && <p className="text-[11px]">+{q.items.length - 2} more</p>}
                          </td>
                          <td className="px-4 py-3 font-bold text-green-700 dark:text-green-400 whitespace-nowrap">
                            {q.totalQuoted !== null ? formatCurrency(Number(q.totalQuoted), q.currency as never) : "—"}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">v{q.quoteVersion}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${cfg.color}`}>
                              <StatusIcon className="h-3 w-3" /> {cfg.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                            {format(q.updatedAt, "MMM d, yyyy")}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-border text-sm">
                  <span className="text-muted-foreground">Page {page} of {totalPages} · {total} quotes</span>
                  <div className="flex gap-2">
                    {page > 1 && (
                      <Link href={filterHref({ page: String(page - 1), search })} className="px-3 py-1.5 rounded-lg border border-border hover:bg-secondary text-xs">Previous</Link>
                    )}
                    {page < totalPages && (
                      <Link href={filterHref({ page: String(page + 1), search })} className="px-3 py-1.5 rounded-lg border border-border hover:bg-secondary text-xs">Next</Link>
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
