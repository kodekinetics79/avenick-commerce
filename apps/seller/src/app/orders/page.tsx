import { requireSellerAnyPermission } from "@/lib/auth";
import { getSellerOrderProjections, db } from "@avenick/database";
import { SellerLayout } from "@/components/layout/seller-layout";
import { OrdersTable, type OrderRow } from "@/components/orders-table";
import { SavedViews } from "@/components/saved-views";
import { PageHeader, FieldWell, Divider, Button } from "@avenick/ui";
import { cn } from "@avenick/utils";
import { format } from "date-fns";
import Link from "next/link";
import { ShoppingCart, Package, Truck, CheckCircle, ArrowRight } from "lucide-react";

export const metadata = { title: "Orders" };

const FILTER_TABS = [
  { value: "", label: "All orders", icon: ShoppingCart },
  { value: "CONFIRMED", label: "Confirmed", icon: Package },
  { value: "PROCESSING", label: "Processing", icon: Package },
  { value: "SHIPPED", label: "Shipped", icon: Truck },
  { value: "DELIVERED", label: "Delivered", icon: CheckCircle },
];

export default async function OrdersPage({ searchParams }: { searchParams: { status?: string } }) {
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
  const scope = activeTab
    ? `at status ${activeTab.replace(/_/g, " ").toLowerCase()}`
    : "on your account";

  return (
    <SellerLayout sellerName={seller.businessNameEn} tier={seller.tier} permissions={membership.permissions}>
      <div className="space-y-stack">
        <PageHeader
          eyebrow="Fulfilment"
          title="Orders"
          // LAW E. The "Total" column on this table is the value of THIS seller's
          // lines, not the order's marketplace-wide total (getSellerOrderProjections
          // recomputes it from the seller's own items). That distinction was
          // previously stated nowhere on the page, which is how a partial figure
          // gets read as a whole one. The row count is stated for the same reason:
          // the query takes 50, so the table is a window, not the ledger.
          dateline={`Orders containing your lines · ${rows.length} shown of ${total} ${scope} · every total is your lines only`}
          linkComponent={Link}
          actions={
            <Button variant="link" size="sm" asChild>
              <Link href="/shipments">
                <Truck className="h-4 w-4" aria-hidden="true" /> Manage shipments
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
          aria-label="Filter orders by fulfilment stage"
          className="flex gap-1 overflow-x-auto scrollbar-thin p-1"
        >
          {FILTER_TABS.map(({ value, label, icon: Icon }) => {
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
                {label}
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
