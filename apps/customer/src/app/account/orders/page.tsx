import { auth } from "@/lib/auth-instance";
import { db, type OrderStatus } from "@avenick/database";
import { redirect } from "next/navigation";
import Link from "next/link";
import { MainLayout } from "@/components/layout/main-layout";
import { formatCurrency } from "@avenick/utils";
import { format } from "date-fns";
import {
  Button,
  CellGrid,
  Dateline,
  Divider,
  EmptyState,
  Num,
  PageHeader,
  Stat,
  StatusPill,
  Surface,
  type PillTone,
} from "@avenick/ui";
import { Package, Truck, CheckCircle, Clock, ChevronRight, RotateCcw } from "lucide-react";

export const metadata = { title: "My Orders" };

/**
 * Status presentation. The old map carried six independent hues — purple, amber,
 * cyan, blue, red, green — which is ten colours carrying zero information, the
 * loudest amateur signal there was in this product. There are now four semantic
 * states plus accent, and the tone says what the buyer should do about it:
 * `warning` is the only one that means "this is waiting on you".
 */
const STATUS_CONFIG: Record<string, { label: string; tone: PillTone; icon: typeof Clock }> = {
  PENDING_PAYMENT:  { label: "Pending payment",  tone: "warning", icon: Clock },
  CONFIRMED:        { label: "Confirmed",        tone: "accent",  icon: CheckCircle },
  PROCESSING:       { label: "Processing",       tone: "neutral", icon: Package },
  READY_FOR_PICKUP: { label: "Ready for pickup", tone: "warning", icon: Package },
  SHIPPED:          { label: "Shipped",          tone: "accent",  icon: Truck },
  DELIVERED:        { label: "Delivered",        tone: "success", icon: CheckCircle },
  CANCELLED:        { label: "Cancelled",        tone: "danger",  icon: Clock },
  RETURNED:         { label: "Returned",         tone: "neutral", icon: RotateCcw },
};

const FILTER_TABS = [
  { value: "",           label: "All orders" },
  { value: "PROCESSING", label: "Processing" },
  { value: "SHIPPED",    label: "Shipped" },
  { value: "DELIVERED",  label: "Delivered" },
  { value: "CANCELLED",  label: "Cancelled" },
];

/** How many item names a row prints before it summarises the rest. */
const ITEM_PREVIEW = 2;

export default async function OrdersPage({ searchParams }: { searchParams: { status?: string } }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const statusFilter = searchParams.status && Object.hasOwn(STATUS_CONFIG, searchParams.status)
    ? searchParams.status as OrderStatus
    : undefined;
  const orders = await db.order.findMany({
    where: { userId: session.user.id, ...(statusFilter ? { status: statusFilter } : {}) },
    orderBy: { createdAt: "desc" },
    include: { items: true, statusHistory: { orderBy: { createdAt: "desc" }, take: 1 } },
  });

  const activeTab = statusFilter ?? "";
  const deliveredCount  = orders.filter(o => o.status === "DELIVERED").length;
  const shippedCount    = orders.filter(o => o.status === "SHIPPED").length;
  const processingCount = orders.filter(o => ["CONFIRMED","PROCESSING"].includes(o.status)).length;
  const activeLabel = statusFilter ? STATUS_CONFIG[statusFilter]?.label.toLowerCase() : undefined;

  return (
    <MainLayout>
      <div className="mx-auto max-w-4xl px-4 py-block">
        <PageHeader
          eyebrow="Account"
          title="My Orders"
          // LAW E. The list is ordered and scoped; saying so is what makes the
          // count below it mean something. The scope has to name the filter when
          // one is applied — "N shown" under a status filter otherwise reads as
          // the number of orders on the account, which it is not.
          dateline={
            activeLabel
              ? `Orders recorded against this account with status "${activeLabel}", newest first · ${orders.length} shown`
              : `Orders recorded against this account, newest first · ${orders.length} shown`
          }
          linkComponent={Link}
          actions={
            <Button variant="secondary" size="sm" asChild>
              <Link href="/returns">
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Returns
              </Link>
            </Button>
          }
        />

        {/* The band is only honest when nothing is filtered: with a status
            filter applied every other count would necessarily read zero, which
            says nothing about the account. */}
        {!statusFilter && orders.length > 0 && (
          <div className="mb-block">
            <CellGrid cols={{ base: 3 }}>
              <Stat label="In progress" value={processingCount} rank="section" />
              <Stat label="Shipped" value={shippedCount} rank="section" />
              <Stat label="Delivered" value={deliveredCount} rank="section" />
            </CellGrid>
            <Dateline className="mt-2">Counted across every order on this account</Dateline>
          </div>
        )}

        {/* Filter tabs. The selected one is marked with the brass drawn rule —
            the same active-indicator gesture the navigation uses — instead of a
            filled indigo pill, which spent the page's one primary fill on a
            filter. aria-current tells assistive technology which is live. */}
        <nav aria-label="Filter orders by status" className="mb-stack flex gap-1 overflow-x-auto border-b border-hairline">
          {FILTER_TABS.map(({ value, label }) => {
            const active = activeTab === value;
            return (
              <Link
                key={value}
                href={value ? `/account/orders?status=${value}` : "/account/orders"}
                aria-current={active ? "page" : undefined}
                className="u-focus u-drawn-host relative shrink-0 rounded-t-nested px-3 pb-2 pt-1.5"
              >
                <span className={active ? "u-ui font-medium text-ink-1" : "u-ui text-ink-3"}>{label}</span>
                <Divider drawn on={active} className="absolute inset-x-0 bottom-0" />
              </Link>
            );
          })}
        </nav>

        {orders.length === 0 ? (
          <Surface rung={2}>
            <EmptyState
              eyebrow="Nothing recorded"
              headline={activeLabel ? `No ${activeLabel} orders on this account.` : "No orders on this account yet."}
              body={
                activeLabel
                  ? "Clear the filter to see every order recorded against this account."
                  : "Orders appear here once they have been placed."
              }
              action={
                <Button variant="primary" size="sm" asChild>
                  <Link href={activeLabel ? "/account/orders" : "/products"}>
                    {activeLabel ? "Show all orders" : "Browse products"}
                  </Link>
                </Button>
              }
            />
          </Surface>
        ) : (
          <ul className="space-y-3">
            {orders.map((order) => {
              const sc = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.CONFIRMED;
              const StatusIcon = sc.icon;
              const preview = order.items.slice(0, ITEM_PREVIEW);
              const remaining = order.items.length - preview.length;
              return (
                // The whole row is one link. It used to contain a second link
                // ("Return or exchange") nested inside the row's own anchor,
                // which is invalid and unreachable by keyboard; returns are
                // reached from the action in the page header instead.
                <Surface as="li" key={order.id} rung={2} interactive className="overflow-hidden">
                  <Link href={`/orders/${order.id}`} className="u-focus block rounded-[inherit] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          {/* Mono is for references — order numbers, SKUs,
                              tracking IDs — and never for money. */}
                          <span className="u-mono u-meta text-ink-2">{order.orderNumber}</span>
                          <StatusPill tone={sc.tone}>
                            <StatusIcon className="h-3 w-3" aria-hidden="true" />
                            {sc.label}
                          </StatusPill>
                          {order.type === "B2B" && <StatusPill tone="neutral">B2B</StatusPill>}
                        </div>
                        <p className="u-meta mt-1 text-ink-3">
                          {format(order.createdAt, "MMM d, yyyy 'at' h:mm a")}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Num value={formatCurrency(Number(order.total), order.currency as never)} />
                        <ChevronRight className="h-4 w-4 text-ink-3 rtl:rotate-180" aria-hidden="true" />
                      </div>
                    </div>

                    {/* The old preview rendered every item and then appended
                        "+ more" whenever there were exactly two, which was
                        simply untrue. It now prints what it prints and counts
                        what it left out. */}
                    <p className="u-ui mt-2 line-clamp-1 text-ink-2">
                      {preview.map((item, i) => (
                        <span key={i}>
                          {i > 0 && <span className="text-ink-3"> · </span>}
                          {item.nameEn}
                          {item.quantity > 1 && <span className="u-meta ms-1 text-ink-3">×{item.quantity}</span>}
                        </span>
                      ))}
                      {remaining > 0 && (
                        <span className="u-meta ms-1.5 text-ink-3">
                          + {remaining} more item{remaining !== 1 ? "s" : ""}
                        </span>
                      )}
                    </p>
                  </Link>
                </Surface>
              );
            })}
          </ul>
        )}
      </div>
    </MainLayout>
  );
}
