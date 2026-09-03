import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { db } from "@avenick/database";
import { Search, Boxes, AlertTriangle, TrendingDown, SlidersHorizontal, CheckCircle } from "lucide-react";
import Link from "next/link";
import {
  PageHeader, CellGrid, LedgerTable, EmptyState, StatusPill, Surface, Num, Button,
} from "@avenick/ui";
import { CountStat } from "@/app/finance/money-figures";
import { FilterTabs, CONTROL } from "@/components/console/chrome";
import { AdjustStock } from "./adjust-stock";

export const metadata = { title: "Stock Manager" };

// Filters that exist in the data model. Aging needs a last-movement or
// received-at timestamp that no row carries, so it is not offered.
const STOCK_FILTER = [
  { value: "",    label: "All Stock" },
  { value: "low", label: "Low Stock" },
  { value: "out", label: "Out of Stock" },
] as const;
type StockFilter = (typeof STOCK_FILTER)[number]["value"];

const PAGE_SIZE = 100;

function stockHref(filter: string, search: string): string {
  const params = new URLSearchParams();
  if (filter) params.set("filter", filter);
  if (search) params.set("search", search);
  const query = params.toString();
  return query ? `/warehouse/stock?${query}` : "/warehouse/stock";
}

export default async function StockPage({ searchParams }: { searchParams: { filter?: string; search?: string } }) {
  await requireAdminSession();

  const activeFilter: StockFilter = STOCK_FILTER.some((f) => f.value === searchParams.filter) ? (searchParams.filter as StockFilter) : "";
  const search = (searchParams.search ?? "").trim().slice(0, 100);
  const textMatch = search ? { contains: search, mode: "insensitive" as const } : undefined;

  const where = {
    product: textMatch
      ? { deletedAt: null, OR: [{ sku: textMatch }, { nameEn: textMatch }, { nameAr: textMatch }, { category: { nameEn: textMatch } }] }
      : { deletedAt: null },
  };

  // SKU and unit totals come from the database over the whole match; the
  // low/out split needs reservedQty against qty, which only the loaded rows
  // can answer, so those two are scoped and labelled as such when truncated.
  const [matchingSKUs, unitAggregate] = await Promise.all([
    db.inventoryStock.count({ where }),
    db.inventoryStock.aggregate({ where, _sum: { qty: true } }),
  ]);
  const stocks = await db.inventoryStock.findMany({
    where,
    take: PAGE_SIZE,
    orderBy: { qty: "asc" },
    include: {
      product: {
        select: {
          sku: true, nameEn: true, nameAr: true, status: true,
          images: { where: { isPrimary: true }, take: 1 },
          seller: { select: { businessNameEn: true } },
          category: { select: { nameEn: true } },
        },
      },
      location: {
        include: { warehouse: { select: { nameEn: true, type: true } } },
      },
    },
  });

  const mapped = stocks.map(s => ({
    ...s,
    available: s.qty - s.reservedQty,
    isOut: s.qty - s.reservedQty <= 0,
    isLow: s.qty - s.reservedQty > 0 && s.qty - s.reservedQty <= s.reorderPoint,
  }));

  // Low/out depend on reservedQty, which no where-clause can compare against
  // another column, so the split is finished in memory on the fetched page.
  const filtered = activeFilter === "low" ? mapped.filter(s => s.isLow)
    : activeFilter === "out" ? mapped.filter(s => s.isOut)
    : mapped;

  const totalSKUs   = matchingSKUs;
  const totalUnits  = unitAggregate._sum.qty ?? 0;
  const lowCount    = mapped.filter(s => s.isLow).length;
  const outCount    = mapped.filter(s => s.isOut).length;
  const truncated   = matchingSKUs > stocks.length;
  const scopeNote   = truncated ? ` (of the ${stocks.length} lowest-stock loaded)` : "";

  return (
    <AdminLayout>
      <div className="space-y-block">
        {/* Header. No "Sync": nothing feeds this ledger from outside, and no
            "Reorder": there is no purchase-order primitive to raise one. */}
        <PageHeader
          linkComponent={Link}
          breadcrumbs={[{ label: "Warehouse", href: "/warehouse" }, { label: "Stock manager" }]}
          eyebrow="Operations"
          title="Stock manager"
          description="On-hand and reserved units per location, as recorded in the inventory ledger."
          dateline={`Ordered lowest stock first · latest ${PAGE_SIZE} loaded`}
        />

        {/* Stats — SKUs and units over every matching row; low/out over the loaded rows */}
        <CellGrid cols={{ base: 2, lg: 4 }} density="compact">
          <CountStat label="SKUs" value={totalSKUs.toLocaleString()} rank="section" dateline="Every row matching the current search" />
          <CountStat label="Units on hand" value={totalUnits.toLocaleString()} dateline="Every row matching the current search" />
          <CountStat
            label="Low stock"
            value={lowCount}
            tone={lowCount > 0 ? "warning" : "default"}
            dateline={truncated ? `Of the ${stocks.length} lowest-stock rows loaded` : "Available at or below the reorder point"}
          />
          <CountStat
            label="Out of stock"
            value={outCount}
            tone={outCount > 0 ? "danger" : "default"}
            dateline={truncated ? `Of the ${stocks.length} lowest-stock rows loaded` : "Nothing available to sell"}
          />
        </CellGrid>

        {/* Alerts */}
        {outCount > 0 && activeFilter !== "out" && (
          <Surface role="status" tone="danger" className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 shrink-0 text-danger-ink" aria-hidden="true" />
              <p className="u-ui font-medium text-ink-1">
                {outCount} SKU{outCount !== 1 ? "s" : ""} with nothing available to sell{scopeNote}
              </p>
            </div>
            <Button variant="secondary" size="sm" asChild>
              <Link href={stockHref("out", search)}>Show them</Link>
            </Button>
          </Surface>
        )}

        {/* Filters */}
        <div className="flex flex-col gap-2 lg:flex-row lg:items-start">
          {/* Search */}
          <form method="get" action="/warehouse/stock" role="search" className="relative min-w-0 flex-1">
            {activeFilter && <input type="hidden" name="filter" value={activeFilter} />}
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden="true" />
            <input
              data-rung={1}
              type="search"
              name="search"
              placeholder="SKU, product name or category…"
              // The inline-end padding has to clear whatever is parked over it:
              // "Search" alone, or "Clear · Search" once a term is active.
              // Sized for the wider case rather than letting the typed term run
              // underneath the controls.
              className={`${CONTROL} ps-9 ${search ? "pe-28" : "pe-20"}`}
              defaultValue={search}
              maxLength={100}
              aria-label="Search stock by SKU, product name or category"
            />
            <div className="absolute end-2 top-1/2 flex -translate-y-1/2 items-center gap-2">
              {search && (
                <Link href={stockHref(activeFilter, "")} className="u-focus u-meta rounded-nested text-ink-3 hover:text-ink-1">
                  Clear
                </Link>
              )}
              <button type="submit" className="u-focus u-meta rounded-nested font-medium text-primary-ink hover:underline">
                Search
              </button>
            </div>
          </form>
          {/* Stock filter */}
          <FilterTabs
            label="Filter stock lines"
            className="shrink-0"
            tabs={STOCK_FILTER.map(({ value, label }) => ({
              href: stockHref(value, search),
              label,
              count: value === "low" ? lowCount : value === "out" ? outCount : undefined,
              active: activeFilter === value,
              icon: value === "" ? SlidersHorizontal : undefined,
            }))}
          />
        </div>

        {/* Stock table */}
        <LedgerTable
          rows={filtered}
          getRowKey={(s) => s.id}
          stickyHead
          density="compact"
          dateline="On-hand and reserved as recorded · available is on-hand less reserved, which is the only number that can be sold"
          rowProps={(s) => ({
            // Hover deepens the same hue. Without a hover variant the generic
            // row hover, a plain background-color, replaces the wash outright.
            className: s.isOut
              ? "bg-danger-soft hover:bg-danger/10"
              : s.isLow
                ? "bg-warning-soft hover:bg-warning/10"
                : undefined,
          })}
          columns={[
            { key: "sku", label: "SKU", render: (s) => <span className="u-mono whitespace-nowrap text-meta font-medium text-ink-2">{s.product?.sku ?? "—"}</span> },
            { key: "product", label: "Product", render: (s) => <span className="line-clamp-1 font-medium text-ink-1">{s.product?.nameEn ?? "—"}</span> },
            { key: "category", label: "Category", hideOnMobile: true, render: (s) => <span className="u-meta text-ink-3">{s.product?.category?.nameEn ?? "—"}</span> },
            { key: "supplier", label: "Supplier", hideOnMobile: true, render: (s) => <span className="u-meta text-ink-3">{s.product?.seller?.businessNameEn ?? "—"}</span> },
            {
              key: "location",
              label: "Warehouse / bin",
              hideOnMobile: true,
              render: (s) => (
                <div className="py-1">
                  <p className="u-meta text-ink-2">{s.location?.warehouse?.nameEn ?? "—"}</p>
                  {s.location?.bin && <p className="u-mono u-meta text-ink-3">{s.location.bin}</p>}
                </div>
              ),
            },
            { key: "qty", label: "On hand", numeric: true, render: (s) => s.qty },
            { key: "reservedQty", label: "Reserved", numeric: true, render: (s) => <span className="text-ink-3">{s.reservedQty}</span> },
            {
              key: "available",
              label: "Available",
              numeric: true,
              render: (s) => (
                <Num
                  value={s.available}
                  className={s.isOut ? "text-danger-ink" : s.isLow ? "text-warning-ink" : "text-ink-1"}
                />
              ),
            },
            { key: "reorderPoint", label: "Reorder pt", numeric: true, render: (s) => <span className="text-ink-3">{s.reorderPoint}</span> },
            {
              key: "status",
              label: "Status",
              render: (s) =>
                s.isOut ? (
                  <StatusPill tone="danger"><AlertTriangle className="h-3 w-3" aria-hidden="true" /> Out</StatusPill>
                ) : s.isLow ? (
                  <StatusPill tone="warning"><TrendingDown className="h-3 w-3" aria-hidden="true" /> Low</StatusPill>
                ) : (
                  <StatusPill tone="success"><CheckCircle className="h-3 w-3" aria-hidden="true" /> OK</StatusPill>
                ),
            },
            {
              key: "action",
              label: "Action",
              align: "end",
              render: (s) => (
                <div className="flex justify-end py-1">
                  <AdjustStock stockId={s.id} qty={s.qty} reservedQty={s.reservedQty} />
                </div>
              ),
            },
          ]}
          empty={
            <EmptyState
              eyebrow="Nothing recorded"
              headline={search ? `Nothing matches “${search}”.` : "No stock line has been recorded."}
              body={
                search
                  ? "Clear the search, or try a SKU, product name or category."
                  : "A stock line is written when inventory is received against a bin location."
              }
              icon={<Boxes className="h-3.5 w-3.5" aria-hidden="true" />}
              action={
                search || activeFilter ? (
                  <Button variant="secondary" size="sm" asChild>
                    <Link href="/warehouse/stock">Show all stock</Link>
                  </Button>
                ) : undefined
              }
            />
          }
          footer={
            filtered.length > 0 ? (
              <span>
                <span className="fig text-ink-2">{filtered.length}</span> SKU{filtered.length !== 1 ? "s" : ""}
                {truncated ? ` shown of the ${stocks.length} lowest-stock loaded (${matchingSKUs.toLocaleString()} match)` : ""}
              </span>
            ) : undefined
          }
        />
      </div>
    </AdminLayout>
  );
}
