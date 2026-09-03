import { requireSellerAnyPermission } from "@/lib/auth";
import { getSellerOrderProjections, db } from "@avenick/database";
import { SellerLayout } from "@/components/layout/seller-layout";
import { OrdersTable, type OrderRow } from "@/components/orders-table";
import { SavedViews } from "@/components/saved-views";
import { orderStatusMeta } from "@/components/orders/status-meta";
import { PageHeader, FieldWell, Divider, Button } from "@avenick/ui";
import { getTranslations } from "next-intl/server";
import { cn } from "@avenick/utils";
import { format } from "date-fns";
import Link from "next/link";
import { ShoppingCart, Package, Truck, CheckCircle, ArrowRight } from "lucide-react";

// generateMetadata rather than a static object: the document title is a
// user-visible string — the browser tab, the history entry, the bookmark — and a
// literal here read English at an Arabic desk.
export async function generateMetadata() {
  const t = await getTranslations("sellerOps");
  return { title: t("orders.metaTitle") };
}

// The tab carries a message KEY, not a label: this array is module scope and has
// no translator in it. The enum in `value` is the query the tab filters on and
// stays untouched.
const FILTER_TABS = [
  { value: "", labelKey: "orders.filters.all", icon: ShoppingCart },
  { value: "CONFIRMED", labelKey: "orders.filters.confirmed", icon: Package },
  { value: "PROCESSING", labelKey: "orders.filters.processing", icon: Package },
  { value: "SHIPPED", labelKey: "orders.filters.shipped", icon: Truck },
  { value: "DELIVERED", labelKey: "orders.filters.delivered", icon: CheckCircle },
];

export default async function OrdersPage({ searchParams }: { searchParams: { status?: string } }) {
  const t = await getTranslations("sellerOps");
  const { seller, membership } = await requireSellerAnyPermission(["orders.view", "orders.fulfill"]);
  const { orders, total } = await getSellerOrderProjections(seller.id, { status: searchParams.status as never, limit: 50 });
  const activeTab = searchParams.status ?? "";

  const savedViews = await db.savedView.findMany({
    where: { sellerId: seller.id, entity: "orders" },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, query: true },
  });

  const rows: OrderRow[] = orders.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    buyer: `${o.user.firstName} ${o.user.lastName}`.trim(),
    company: o.company?.nameEn ?? "",
    date: format(o.createdAt, "MMM d, yyyy"),
    itemCount: o.items.length,
    total: Number(o.total),
    currency: o.currency,
    type: o.type,
    status: o.status,
  }));

  // Only name a stage when one is actually selected, and name the stage the QUERY
  // filtered on rather than the label of a matching tab. A saved view can carry a
  // status that has no tab (CANCELLED, RETURNED); falling back to the first tab's
  // label would have told the reader they were looking at "all orders" while the
  // table beneath showed a filtered subset.
  //
  // Two whole sentences in the message tree rather than one sentence with a
  // fragment spliced into it: a scope clause assembled from pieces cannot be
  // reordered by a translator, and Arabic does not put this clause where English
  // does. The counts are passed as STRINGS so the figures stay Western digits in
  // both languages.
  //
  // The stage name inside that sentence comes from the ONE order-status
  // vocabulary (components/orders/status-meta.ts) rather than from a second copy
  // written here: a raw enum spliced into an Arabic sentence reads as an English
  // word mid-clause, and a private map would be the third map for this enum that
  // status-meta.ts exists to prevent. Its fallback for an unmapped status is the
  // same underscore-stripped lowercase form this line used before, so a saved
  // view carrying a status nobody has named yet still reads as it always did.
  const dateline = activeTab
    ? t("orders.dateline.atStatus", {
        shown: String(rows.length),
        total: String(total),
        status: orderStatusMeta(activeTab).label.toLowerCase(),
      })
    : t("orders.dateline.all", { shown: String(rows.length), total: String(total) });

  return (
    <SellerLayout sellerName={seller.businessNameEn} tier={seller.tier} permissions={membership.permissions}>
      <div className="space-y-stack">
        <PageHeader
          eyebrow={t("orders.eyebrow")}
          title={t("orders.title")}
          // LAW E. The "Total" column on this table is the value of THIS seller's
          // lines, not the order's marketplace-wide total (getSellerOrderProjections
          // recomputes it from the seller's own items). That distinction was
          // previously stated nowhere on the page, which is how a partial figure
          // gets read as a whole one. The row count is stated for the same reason:
          // the query takes 50, so the table is a window, not the ledger.
          // The sentence itself is orders.dateline.all / orders.dateline.atStatus.
          dateline={dateline}
          linkComponent={Link}
          actions={
            <Button variant="link" size="sm" asChild>
              <Link href="/shipments">
                <Truck className="h-4 w-4" aria-hidden="true" /> {t("orders.manageShipments")}
                {/* A direction-implying icon, not a literal "→": an ASCII arrow
                    cannot flip for Arabic. */}
                <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden="true" />
              </Link>
            </Button>
          }
        />

        {/* The stage filter is a recessed track, because the system reserves rung 1
            for context and input and this row is both. The selected stage is the
            only raised object in it and carries the brass drawn rule — the
            active-indicator, which is one of brass's three permitted uses. */}
        <FieldWell
          as="nav"
          aria-label={t("orders.filters.navLabel")}
          className="flex gap-1 overflow-x-auto scrollbar-thin p-1"
        >
          {FILTER_TABS.map(({ value, labelKey, icon: Icon }) => {
            const active = activeTab === value;
            return (
              <Link
                key={value || "all"}
                href={value ? `/orders?status=${value}` : "/orders"}
                aria-current={active ? "page" : undefined}
                data-focus-lift=""
                className={cn(
                  "relative flex shrink-0 items-center gap-1.5 rounded-nested px-3 pb-2 pt-1.5 text-ui outline-none",
                  "transition-[background-color,color,box-shadow] duration-hover ease-standard",
                  active
                    ? "bg-surface-2 text-ink-1 shadow-elev-2"
                    : "text-ink-3 hover:bg-ink-1/[0.04] hover:text-ink-1",
                )}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {t(labelKey)}
                <Divider drawn on={active} className="absolute inset-x-2 bottom-1" />
              </Link>
            );
          })}
        </FieldWell>

        <SavedViews entity="orders" basePath="/orders" views={savedViews} />

        <OrdersTable rows={rows} total={total} />
      </div>
    </SellerLayout>
  );
}
