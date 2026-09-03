import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, FileText, Inbox, Users } from "lucide-react";
import {
  Button,
  CellGrid,
  Dateline,
  EmptyState,
  Eyebrow,
  LedgerTable,
  Num,
  Stat,
  StatusPill,
  Surface,
} from "@avenick/ui";
import { B2BShell } from "@/components/b2b/b2b-shell";
import { Money, CurrencyLedger } from "@/components/b2b/money";
import { getB2B, b2bMetadata } from "@/components/b2b/i18n";
import type { B2BKey } from "@/components/b2b/messages";
import { toneRule } from "@/components/b2b/rules";
import { fetchB2BJson } from "@/lib/b2b";

export async function generateMetadata() {
  return b2bMetadata("shell.workspace");
}
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

  const { t, f } = await getB2B();
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
   * belongs here too.
   */
  const queue: Array<{ href: string; label: string; count: number; tone: "warning" | "accent"; note: string }> = [];
  if (pendingApprovals > 0) {
    queue.push({
      href: "/b2b/approvals",
      label: t(pendingApprovals === 1 ? "dash.queue.approvals.one" : "dash.queue.approvals.other"),
      count: pendingApprovals,
      tone: "warning",
      note: t("dash.queue.approvals.note"),
    });
  }
  if (openRFQs > 0) {
    queue.push({
      href: "/b2b/quotes",
      label: t(openRFQs === 1 ? "dash.queue.rfqs.one" : "dash.queue.rfqs.other"),
      count: openRFQs,
      tone: "accent",
      note: t("dash.queue.rfqs.note"),
    });
  }

  return (
    <B2BShell eyebrow={t("dash.eyebrow")} title={company.nameEn}>
      <div className="space-y-block">
        {/* ══ THE DESK ══════════════════════════════════════════════════════
            The one enormous thing on this screen, and it is a count the
            database actually holds.

            Round one put this queue at the top and then set it at document
            scale: a 13px label beside a pill. A procurement manager opening
            this page is asking exactly one question — what needs me today —
            and the answer was the same size as everything else on the page.
            The count is now a hero-rank figure at 46px against 15px body, and
            it is the only figure on the page at that rank.

            The 3px inline-start rule answers the second question, whose move it
            is, without spending a word or a pill on it: amber is yours, right
            now; verdigris is the supplier's. Same rule, same three pixels, on
            every row — only the colour changes.

            When the queue is empty this becomes the Certificate rather than
            disappearing. A queue that vanishes when it empties leaves the
            reader unsure whether it ran at all, and an honest empty surface is
            the one thing this product must be able to do beautifully. */}
        <section aria-label={t("dash.desk.heading")}>
        {queue.length === 0 ? (
          <EmptyState
            variant="certificate"
            glyph={<Inbox />}
            eyebrow={t("dash.desk.eyebrow")}
            headline={t("dash.desk.clear.headline")}
            body={t("dash.desk.clear.body")}
            action={
              <Button asChild variant="secondary">
                <Link href="/b2b/rfq/new">{t("dash.desk.clear.action")}</Link>
              </Button>
            }
          />
        ) : (
          <Surface rung={1} className="overflow-hidden">
            <div className="u-drawn w-14" data-on="true" aria-hidden="true" />
            <div className="p-4 sm:p-5">
              <Eyebrow className="mb-3">{t("dash.desk.eyebrow")}</Eyebrow>
              <ul className="space-y-2">
                {queue.map((entry) => (
                  <li key={entry.href}>
                    {/* rounded-lg resolves to the portal's --radius, so the focus
                        ring on the link is concentric with the surface it wraps. */}
                    <Link href={entry.href} className="u-focus block rounded-lg">
                      <Surface
                        rung={2}
                        interactive
                        className={`flex items-center gap-4 px-4 py-4 sm:px-5 ${toneRule(entry.tone)}`}
                      >
                        {/* The figure is never animated. On a trade platform a
                            count that ticks is a count you cannot trust. */}
                        <Num value={entry.count} rank="hero" className="shrink-0" />
                        <span className="min-w-0 flex-1">
                          <span className="u-h3 block text-ink-1">{entry.label}</span>
                          <span className="u-meta mt-0.5 block text-ink-2">{entry.note}</span>
                        </span>
                        {/* rtl:rotate-180 — a direction-implying icon must flip. */}
                        <ChevronRight className="h-4 w-4 shrink-0 text-ink-3 rtl:rotate-180" aria-hidden="true" />
                      </Surface>
                    </Link>
                  </li>
                ))}
              </ul>
              <Dateline className="mt-3">{t("dash.desk.basis")}</Dateline>
            </div>
          </Surface>
        )}
        </section>

        {/* ══ POSITION ══════════════════════════════════════════════════════
            One panel divided by hairlines, not four floating boxes. Every
            figure here is at inline rank on purpose: the desk above owns the
            page's one hero-rank figure, and a second one would halve it. */}
        <CellGrid cols={{ base: 2, lg: 4 }}>
          <div>
            <Eyebrow>{t("dash.lifetimeSpend")}</Eyebrow>
            <div className="mt-1.5">
              {/* One figure per currency the company has actually paid in —
                  never a mixed sum labelled with a currency nobody chose. */}
              <CurrencyLedger
                rows={lifetimeSpendByCurrency}
                label={t("money.byCurrency")}
                single={t("dash.lifetimeSpend.basis")}
                multi={t("money.noConversion")}
                emptyLabel={t("money.nothingRecorded")}
              />
            </div>
          </div>
          <div>
            <Eyebrow>{t("dash.creditLimit")}</Eyebrow>
            <div className="mt-1.5">
              {creditLimit ? (
                <Money amount={creditLimit} currency={companyCurrency} />
              ) : (
                <span className="u-body text-ink-2">{t("common.notSet")}</span>
              )}
            </div>
            <Dateline className="mt-1">{t("dash.creditLimit.basis", { currency: companyCurrency })}</Dateline>
          </div>
          {/* Orders, not purchase orders — _count.orders counts Order rows, so
              the link goes to the order history rather than to the PO queue,
              whose count is a different number entirely. */}
          <Stat
            label={t("dash.ordersToDate")}
            value={company._count.orders}
            icon={FileText}
            href="/account/orders"
            linkComponent={Link}
          />
          <Stat
            label={t("dash.teamMembers")}
            value={company._count.members}
            icon={Users}
            href="/b2b/team"
            linkComponent={Link}
          />
        </CellGrid>

        {/* ══ TWO LEDGERS ═══════════════════════════════════════════════════
            Both halves are now the same object. "Buy again" used to be a
            hand-rolled <ul> beside a real table, which is how a page ends up
            with two different treatments for two lists of the same weight. */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <LedgerTable
            title={t("dash.recentOrders")}
            rows={recentOrders}
            getRowKey={(o) => o.id}
            toolbar={
              <Button asChild variant="link" size="sm">
                <Link href="/account/orders">{t("dash.allOrders")}</Link>
              </Button>
            }
            columns={[
              {
                key: "orderNumber",
                label: t("dash.col.order"),
                render: (o) => (
                  <Link href={`/orders/${o.id}`} className="u-focus u-mono rounded-nested text-primary-ink hover:underline">
                    {o.orderNumber}
                  </Link>
                ),
              },
              {
                key: "createdAt",
                label: t("dash.col.placed"),
                render: (o) => <span className="u-meta whitespace-nowrap text-ink-2">{f.date(o.createdAt)}</span>,
              },
              {
                key: "status",
                label: t("common.status"),
                render: (o) => (
                  <StatusPill className="whitespace-nowrap">
                    {t(`status.order.${o.status}` as B2BKey)}
                  </StatusPill>
                ),
              },
              {
                key: "total",
                label: t("common.total"),
                numeric: true,
                render: (o) => <Money amount={Number(o.total)} currency={o.currency} />,
              },
            ]}
            empty={
              /* Default variant, not the Certificate. THE RULE, and it is worth
                 stating: a full-width empty REGION gets the composed plate; a
                 half-width table inside a two-up grid gets the centred blank
                 with a real action. Three certificates stacked down one page
                 stop reading as composition and start reading as a template.
                 What round one actually got wrong here was not the variant — it
                 was shipping an empty state with no way out of it. */
              <EmptyState
                eyebrow={t("dash.orders.empty.eyebrow")}
                headline={t("dash.orders.empty.headline")}
                body={t("dash.orders.empty.body")}
                action={
                  <Button asChild variant="secondary" size="sm">
                    <Link href="/products?b2b=true">{t("dash.orders.empty.action")}</Link>
                  </Button>
                }
              />
            }
          />

          <LedgerTable
            title={t("dash.buyAgain")}
            dateline={t("dash.buyAgain.basis")}
            rows={reorderItems}
            getRowKey={(item) => item.id}
            columns={[
              {
                key: "nameEn",
                label: t("dash.col.order"),
                render: (item) => (
                  <div className="min-w-0 py-1">
                    <p className="u-ui truncate font-medium text-ink-1">{item.nameEn}</p>
                    {/* The SKU is a first-class comparison attribute for a
                        procurement audience and it is the densest true fact
                        this row holds, so it gets its own line rather than
                        being appended to a sentence. */}
                    <p className="u-mono u-meta text-ink-3">{item.sku}</p>
                  </div>
                ),
              },
              {
                key: "quantity",
                label: t("common.total"),
                numeric: true,
                render: (item) => (
                  <span className="u-meta whitespace-nowrap text-ink-2">
                    {t("dash.buyAgain.lastOrdered", { qty: item.quantity })}
                  </span>
                ),
              },
              {
                key: "actions",
                label: t("common.actions"),
                align: "end",
                render: (item) =>
                  item.product && item.product.status === "ACTIVE" ? (
                    <Button asChild variant="secondary" size="xs" className="shrink-0">
                      <Link href={`/products/${item.product.slug}`}>{t("dash.buyAgain.reorder")}</Link>
                    </Button>
                  ) : (
                    <span className="u-meta shrink-0 text-ink-3">{t("dash.buyAgain.unavailable")}</span>
                  ),
              },
            ]}
            empty={
              <EmptyState
                eyebrow={t("dash.buyAgain.empty.eyebrow")}
                headline={t("dash.buyAgain.empty.headline")}
                body={t("dash.buyAgain.empty.body")}
                action={
                  <Button asChild variant="secondary" size="sm">
                    <Link href="/products?b2b=true">{t("dash.buyAgain.empty.action")}</Link>
                  </Button>
                }
              />
            }
          />
        </div>
      </div>
    </B2BShell>
  );
}
