import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { db } from "@avenick/database";
import { formatCurrency } from "@avenick/utils";
import { ArrowLeft, Search, Boxes, AlertTriangle, RefreshCw, TrendingDown, SlidersHorizontal } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "Stock Manager" };

const WAREHOUSE_FILTER = [
  { value: "",      label: "All Warehouses" },
  { value: "wh1",   label: "Dubai Main" },
  { value: "wh2",   label: "Riyadh Hub" },
  { value: "wh3",   label: "Abu Dhabi" },
];

const STOCK_FILTER = [
  { value: "",       label: "All Stock" },
  { value: "low",    label: "Low Stock" },
  { value: "out",    label: "Out of Stock" },
  { value: "aging",  label: "Aging (60+ days)" },
];

export default async function StockPage({ searchParams }: { searchParams: { filter?: string; search?: string } }) {
  await requireAdminSession();

  const stocks = await db.inventoryStock.findMany({
    where: {
      product: { deletedAt: null },
      ...(searchParams.filter === "low"  ? { qty: { gt: 0 } } : {}),
      ...(searchParams.filter === "out"  ? { qty: { lte: 0 } } : {}),
    },
    take: 100,
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

  const filtered = searchParams.filter === "low" ? mapped.filter(s => s.isLow)
    : searchParams.filter === "out" ? mapped.filter(s => s.isOut)
    : mapped;

  const totalSKUs   = mapped.length;
  const lowCount    = mapped.filter(s => s.isLow).length;
  const outCount    = mapped.filter(s => s.isOut).length;
  const totalUnits  = mapped.reduce((s, i) => s + i.qty, 0);

  const activeFilter = searchParams.filter ?? "";

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
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
            <p className="text-sm text-muted-foreground">Real-time inventory across all warehouses</p>
          </div>
          <div className="flex gap-2">
            <button type="button" className="flex items-center gap-1.5 text-sm border border-border bg-white text-slate-700 hover:bg-slate-50 px-3 py-2 rounded-xl font-medium transition-colors">
              <RefreshCw className="h-3.5 w-3.5" /> Sync
            </button>
            <button type="button" className="flex items-center gap-1.5 text-sm bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl font-semibold transition-colors">
              <Boxes className="h-3.5 w-3.5" /> Adjust Stock
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total SKUs",    value: totalSKUs,  color: "text-slate-800", bg: "bg-white border-border" },
            { label: "Total Units",   value: totalUnits.toLocaleString(), color: "text-blue-700", bg: "bg-blue-50 border-blue-200" },
            { label: "Low Stock",     value: lowCount,   color: lowCount > 0 ? "text-amber-700" : "text-slate-500",  bg: lowCount > 0 ? "bg-amber-50 border-amber-200" : "bg-white border-border" },
            { label: "Out of Stock",  value: outCount,   color: outCount > 0 ? "text-red-700" : "text-slate-500",    bg: outCount > 0 ? "bg-red-50 border-red-200" : "bg-white border-border" },
          ].map(({ label, value, color, bg }) => (
            <div key={label} className={`rounded-2xl border p-4 ${bg}`}>
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Alerts */}
        {outCount > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
              <p className="font-semibold text-red-800 text-sm">{outCount} SKU{outCount !== 1 ? "s" : ""} out of stock — listings may be suppressed</p>
            </div>
            <Link href="/warehouse/stock?filter=out" className="text-xs bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 font-medium transition-colors">View →</Link>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="flex items-center gap-2 bg-white border border-border rounded-xl px-3 py-2 flex-1">
            <Search className="h-4 w-4 text-slate-400 shrink-0" />
            <input type="text" placeholder="Search by SKU, product name, or category..."
              className="flex-1 text-sm text-slate-600 placeholder:text-slate-400 outline-none bg-transparent"
              defaultValue={searchParams.search ?? ""} />
          </div>
          {/* Stock filter */}
          <div className="flex gap-1.5 overflow-x-auto">
            <SlidersHorizontal className="h-4 w-4 text-muted-foreground shrink-0 self-center" />
            {STOCK_FILTER.map(({ value, label }) => (
              <Link key={value} href={value ? `/warehouse/stock?filter=${value}` : "/warehouse/stock"}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${activeFilter === value ? "bg-slate-900 text-white" : "bg-white border border-border text-muted-foreground hover:border-slate-400"}`}>
                {label}
                {value === "low"  && lowCount  > 0 && <span className="ms-1 text-amber-400 font-bold">{lowCount}</span>}
                {value === "out"  && outCount  > 0 && <span className="ms-1 text-red-400 font-bold">{outCount}</span>}
              </Link>
            ))}
          </div>
        </div>

        {/* Stock table */}
        <div className="bg-white rounded-2xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-border">
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
                  </td></tr>
                ) : filtered.map((s) => (
                  <tr key={s.id} className={`hover:bg-slate-50 transition-colors ${s.isOut ? "bg-red-50/30" : s.isLow ? "bg-amber-50/30" : ""}`}>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-600">{s.product?.sku ?? "—"}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-sm line-clamp-1">{s.product?.nameEn ?? "—"}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{s.product?.category?.nameEn ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{s.product?.seller?.businessNameEn ?? "—"}</td>
                    <td className="px-4 py-3">
                      <p className="text-xs text-muted-foreground">{s.location?.warehouse?.nameEn ?? "—"}</p>
                      {s.location?.bin && <p className="font-mono text-xs text-slate-600">{s.location.bin}</p>}
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
                      <div className="flex gap-1.5">
                        <button type="button" className="text-xs text-blue-600 hover:underline font-medium">Adjust</button>
                        {(s.isLow || s.isOut) && (
                          <button type="button" className="text-xs bg-amber-500 text-white px-2 py-0.5 rounded-lg hover:bg-amber-600 font-medium transition-colors">Reorder</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length > 0 && (
            <div className="px-4 py-3 border-t border-border bg-slate-50 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">{filtered.length} SKU{filtered.length !== 1 ? "s" : ""}</p>
              <button type="button" className="text-xs text-blue-600 hover:underline font-medium">Export CSV →</button>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
