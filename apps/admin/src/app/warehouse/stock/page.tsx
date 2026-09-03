import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { db } from "@avenick/database";
import { ArrowLeft, Search, Boxes, AlertTriangle, TrendingDown, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
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
      <div className="space-y-6">
        {/* Header. No "Sync": nothing feeds this ledger from outside, and no
            "Reorder": there is no purchase-order primitive to raise one. */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link href="/warehouse" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
                <ArrowLeft className="h-3.5 w-3.5" /> Warehouse
              </Link>
              <span className="text-muted-foreground">/</span>
              <span className="text-sm font-medium">Stock Manager</span>
            </div>
            <h1 className="text-2xl font-bold">Stock Manager</h1>
            <p className="text-sm text-muted-foreground">On-hand and reserved units per location, as recorded in the inventory ledger</p>
          </div>
        </div>

        {/* Stats — SKUs and units over every matching row; low/out over the loaded rows */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "SKUs", value: totalSKUs.toLocaleString(),  color: "text-foreground", bg: "bg-card border-border" },
            { label: "Units on hand",  value: totalUnits.toLocaleString(), color: "text-primary", bg: "bg-primary/10 border-primary/20" },
            { label: `Low Stock${scopeNote}`,     value: lowCount,   color: lowCount > 0 ? "text-amber-700" : "text-muted-foreground",  bg: lowCount > 0 ? "bg-amber-500/10 border-amber-500/20" : "bg-card border-border" },
            { label: `Out of Stock${scopeNote}`,  value: outCount,   color: outCount > 0 ? "text-red-700" : "text-muted-foreground",    bg: outCount > 0 ? "bg-red-500/10 border-red-500/20" : "bg-card border-border" },
          ].map(({ label, value, color, bg }) => (
            <div key={label} className={`rounded-2xl border p-4 ${bg}`}>
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Alerts */}
        {outCount > 0 && activeFilter !== "out" && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
              <p className="font-semibold text-red-800 text-sm">{outCount} SKU{outCount !== 1 ? "s" : ""} with nothing available to sell{scopeNote}</p>
            </div>
            <Link href={stockHref("out", search)} className="text-xs bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 font-medium transition-colors">View →</Link>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <form method="get" action="/warehouse/stock" role="search" className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-2 flex-1">
            {activeFilter && <input type="hidden" name="filter" value={activeFilter} />}
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <input type="search" name="search" placeholder="Search by SKU, product name, or category…"
              className="flex-1 text-sm placeholder:text-muted-foreground outline-none bg-transparent"
              defaultValue={search} maxLength={100} aria-label="Search stock" />
            <button type="submit" className="text-xs text-primary font-medium hover:underline">Search</button>
            {search && <Link href={stockHref(activeFilter, "")} className="text-xs text-muted-foreground hover:underline">Clear</Link>}
          </form>
          {/* Stock filter */}
          <div className="flex gap-1.5 overflow-x-auto">
            <SlidersHorizontal className="h-4 w-4 text-muted-foreground shrink-0 self-center" />
            {STOCK_FILTER.map(({ value, label }) => (
              <Link key={value} href={stockHref(value, search)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${activeFilter === value ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground hover:bg-muted"}`}>
                {label}
                {value === "low"  && lowCount  > 0 && <span className="ms-1 text-amber-400 font-bold">{lowCount}</span>}
                {value === "out"  && outCount  > 0 && <span className="ms-1 text-red-400 font-bold">{outCount}</span>}
              </Link>
            ))}
          </div>
        </div>

        {/* Stock table */}
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted border-b border-border">
                <tr>
                  {["SKU","Product","Category","Supplier","Warehouse / Bin","On Hand","Reserved","Available","Reorder Pt","Status","Action"].map(h => (
                    <th key={h} className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.length === 0 ? (
                  <tr><td colSpan={11} className="px-4 py-16 text-center">
                    <Boxes className="h-10 w-10 mx-auto text-slate-200 mb-3" />
                    <p className="font-semibold text-muted-foreground">No stock records found</p>
                    {search && <p className="text-xs text-muted-foreground mt-1">Nothing matches “{search}”</p>}
                  </td></tr>
                ) : filtered.map((s) => (
                  <tr key={s.id} className={`hover:bg-muted/30 transition-colors align-top ${s.isOut ? "bg-red-500/5" : s.isLow ? "bg-amber-500/5" : ""}`}>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-muted-foreground">{s.product?.sku ?? "—"}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-sm line-clamp-1">{s.product?.nameEn ?? "—"}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{s.product?.category?.nameEn ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{s.product?.seller?.businessNameEn ?? "—"}</td>
                    <td className="px-4 py-3">
                      <p className="text-xs text-muted-foreground">{s.location?.warehouse?.nameEn ?? "—"}</p>
                      {s.location?.bin && <p className="font-mono text-xs text-muted-foreground">{s.location.bin}</p>}
                    </td>
                    <td className="px-4 py-3 font-bold text-sm text-center">{s.qty}</td>
                    <td className="px-4 py-3 text-sm text-center text-muted-foreground">{s.reservedQty}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`font-bold text-sm ${s.isOut ? "text-red-600" : s.isLow ? "text-amber-600" : "text-green-700"}`}>
                        {s.available}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-center text-muted-foreground">{s.reorderPoint}</td>
                    <td className="px-4 py-3">
                      {s.isOut
                        ? <span className="flex items-center gap-1 text-xs font-semibold text-red-600"><AlertTriangle className="h-3 w-3" /> Out</span>
                        : s.isLow
                        ? <span className="flex items-center gap-1 text-xs font-semibold text-amber-600"><TrendingDown className="h-3 w-3" /> Low</span>
                        : <span className="text-xs font-semibold text-green-600">OK</span>}
                    </td>
                    <td className="px-4 py-3">
                      <AdjustStock stockId={s.id} qty={s.qty} reservedQty={s.reservedQty} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length > 0 && (
            <div className="px-4 py-3 border-t border-border bg-muted flex items-center justify-between">
              <p className="text-xs text-muted-foreground">{filtered.length} SKU{filtered.length !== 1 ? "s" : ""}{truncated ? ` shown of the ${stocks.length} lowest-stock loaded (${matchingSKUs.toLocaleString()} match)` : ""}</p>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
