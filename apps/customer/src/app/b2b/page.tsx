import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, FileText, RotateCcw, Users } from "lucide-react";
import {
  Button,
  CellGrid,
  Dateline,
  EmptyState,
  Eyebrow,
  LedgerTable,
  Stat,
  StatusPill,
  Surface,
} from "@avenick/ui";
import { B2BShell } from "@/components/b2b/b2b-shell";
import { Money, MoneyStack } from "@/components/b2b/money";
import { fetchB2BJson } from "@/lib/b2b";
import { format } from "date-fns";

export const metadata = { title: "B2B Dashboard" };
export const dynamic = "force-dynamic";

type DashboardData = {
  company: {
    nameEn: string;
    creditLimit: string | number | null;
    _count: { members: number; orders: number; purchaseOrders: number };
  };
  companyCurrency: string;
  lifetimeSpendByCurrency: Array<{ currency: string; total: number }>;
  pendingApprovals: number;
  openRFQs: number;
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    status: string;
    total: string | number;
    currency: string;
    createdAt: string;
  }>;
  reorderItems: Array<{
    id: string;
    nameEn: string;
    quantity: number;
    sku: string;
    product: { slug: string; status: string } | null;
  }>;
};

export default async function B2BDashboardPage() {
  let data: DashboardData;
  try {
    data = await fetchB2BJson<DashboardData>("/api/b2b/dashboard");
  } catch {
    redirect("/b2b/register");
  }

  const { company, companyCurrency, lifetimeSpendByCurrency, pendingApprovals, openRFQs, recentOrders, reorderItems } = data;
  const creditLimit = company.creditLimit ? Number(company.creditLimit) : null;

  /*
   * What is open on this company's desk, above the fold, before anything else.
   *
   * Only states the data actually supports get a row, and only in the terms the
   * data supports them. /api/b2b/dashboard counts every PENDING_APPROVAL PO
   * belonging to the COMPANY — it does not know which approver a policy routed
   * one to, and it does not know whether the viewer is an approver at all, so
   * nothing here may say "routed to you". A buyer with no approver role sees
   * this band, and the approvals page correctly tells them a decision needs an
   * approver or admin role.
   *
   * An open RFQ is work a supplier owes the company, but no notification is
   * sent when a quote lands, so checking is genuinely the buyer's job and it
   * belongs here too. When both are zero the band says so — it does not
   * disappear, because a queue that vanishes when it empties leaves the reader
   * unsure whether it ran.
   */
  const queue: Array<{ href: string; label: string; count: number; tone: "warning" | "accent"; note: string }> = [];
  if (pendingApprovals > 0) {
    queue.push({
      href: "/b2b/approvals",
      label: `purchase order${pendingApprovals === 1 ? "" : "s"} awaiting approval`,
      count: pendingApprovals,
      tone: "warning",
      note: "Waiting on an approver or admin at your company.",
    });
  }
  if (openRFQs > 0) {
    queue.push({
      href: "/b2b/quotes",
      label: `open request${openRFQs === 1 ? "" : "s"} for quotation`,
      count: openRFQs,
      tone: "accent",
      note: "No alert is sent when a supplier prices one, so check the quote list.",
    });
  }

  return (
    <B2BShell eyebrow="Overview" title={company.nameEn}>
      <div className="space-y-block">
        {/* ── What is open right now ────────────────────────────────────────
            A recessed band, because it is context about the state of the
            workspace, carrying raised rows because each one is an action. It
            is the first thing on the page for the same reason a queue is the
            first thing on a desk. The heading says "open" rather than "needs
            you" because the counts behind it are the company's, not the
            viewer's — see the note on `queue` above. */}
        <Surface rung={1} className="p-4">
          <Eyebrow className="mb-3">Open now</Eyebrow>
          {queue.length === 0 ? (
            <>
              <p className="u-body text-ink-1">Nothing is open.</p>
              <Dateline className="mt-1">
                Counts your company&apos;s purchase orders awaiting approval and its requests for quotation still open
              </Dateline>
            </>
          ) : (
            <ul className="space-y-2">
              {queue.map((entry) => (
                <li key={entry.href}>
                  {/* rounded-lg resolves to the portal's --radius, so the focus
                      ring on the link is concentric with the surface it wraps. */}
                  <Link href={entry.href} className="u-focus block rounded-lg">
                    <Surface rung={2} interactive className="flex items-center gap-3 px-4 py-3">
                      <StatusPill tone={entry.tone} dot>
                        {entry.count}
                      </StatusPill>
                      <span className="min-w-0 flex-1">
                        <span className="u-ui block font-medium text-ink-1">{entry.label}</span>
                        <span className="u-meta block text-ink-2">{entry.note}</span>
                      </span>
                      {/* rtl:rotate-180 — a direction-implying icon must flip. */}
                      <ChevronRight className="h-4 w-4 shrink-0 text-ink-3 rtl:rotate-180" aria-hidden="true" />
                    </Surface>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Surface>

        {/* ── Position ──────────────────────────────────────────────────────
            One panel divided by hairlines, not four floating boxes. The team
            and order counts used to be a grey subtitle under the company name;
            they are figures, so they are rendered as figures. */}
        <CellGrid cols={{ base: 2, lg: 4 }}>
          <div>
            <Eyebrow>Lifetime spend</Eyebrow>
            <div className="mt-1.5">
              {/* One figure per currency the company has actually paid in — never
                  a mixed sum labelled with a currency nobody chose. */}
              <MoneyStack
                rows={lifetimeSpendByCurrency}
                dateline="Paid order totals, as recorded, each in its own currency · no conversion applied"
              />
            </div>
          </div>
          <div>
            <Eyebrow>Credit limit</Eyebrow>
            <div className="mt-1.5">
              {creditLimit ? (
                <Money amount={creditLimit} currency={companyCurrency} />
              ) : (
                <span className="u-body text-ink-2">Not set</span>
              )}
            </div>
            <Dateline className="mt-1">Read in {companyCurrency}, your company&apos;s jurisdiction currency</Dateline>
          </div>
          {/* Orders, not purchase orders — _count.orders counts Order rows, so
              the link goes to the order history rather than to the PO queue,
              whose count is a different number entirely. */}
          <Stat
            label="Orders to date"
            value={company._count.orders}
            icon={FileText}
            href="/account/orders"
            linkComponent={Link}
          />
          <Stat label="Team members" value={company._count.members} icon={Users} href="/b2b/team" linkComponent={Link} />
        </CellGrid>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* ── Recent orders ── */}
          <LedgerTable
            title="Recent orders"
            rows={recentOrders}
            getRowKey={(o) => o.id}
            toolbar={
              <Button asChild variant="link" size="sm">
                <Link href="/account/orders">All orders</Link>
              </Button>
            }
            columns={[
              {
                key: "orderNumber",
                label: "Order",
                render: (o) => (
                  <Link href={`/orders/${o.id}`} className="u-focus u-mono rounded-nested text-primary-ink hover:underline">
                    {o.orderNumber}
                  </Link>
                ),
              },
              {
                key: "createdAt",
                label: "Placed",
                render: (o) => (
                  <span className="u-meta text-ink-2">{format(new Date(o.createdAt), "MMM d, yyyy")}</span>
                ),
              },
              {
                key: "status",
                label: "Status",
                render: (o) => <StatusPill>{o.status.replace(/_/g, " ").toLowerCase()}</StatusPill>,
              },
              {
                key: "total",
                label: "Total",
                numeric: true,
                render: (o) => <Money amount={Number(o.total)} currency={o.currency} />,
              },
            ]}
            empty={
              <EmptyState
                eyebrow="Nothing recorded"
                headline="No orders have been placed by this company yet."
                body="Orders raised from the catalogue or from an accepted quote will be listed here."
              />
            }
          />

          {/* ── Buy again ── */}
          <Surface rung={2} className="overflow-hidden">
            <div className="flex items-center gap-2 px-4 pt-4 pb-3">
              <RotateCcw className="h-4 w-4 text-ink-3" aria-hidden="true" />
              <h2 className="u-h3 text-ink-1">Buy again</h2>
            </div>
            {reorderItems.length === 0 ? (
              <EmptyState
                eyebrow="Nothing recorded"
                headline="No previously ordered products to repeat."
                body="Products from your company's past orders appear here so they can be reordered without searching."
              />
            ) : (
              <ul className="border-t border-hairline">
                {reorderItems.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between gap-3 border-b border-hairline px-4 py-3 last:border-b-0"
                  >
                    <div className="min-w-0">
                      <p className="u-ui truncate font-medium text-ink-1">{item.nameEn}</p>
                      <p className="u-meta text-ink-3">
                        Last ordered ×{item.quantity} · <span className="u-mono">{item.sku}</span>
                      </p>
                    </div>
                    {item.product && item.product.status === "ACTIVE" ? (
                      <Button asChild variant="secondary" size="xs" className="shrink-0">
                        <Link href={`/products/${item.product.slug}`}>Reorder</Link>
                      </Button>
                    ) : (
                      <span className="u-meta shrink-0 text-ink-3">Unavailable</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Surface>
        </div>
      </div>
    </B2BShell>
  );
}
