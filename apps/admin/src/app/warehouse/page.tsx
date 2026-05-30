import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { MOCK_WAREHOUSE_DATA } from "@manzil/database";
import { Package, Truck, AlertTriangle, Clock, BarChart2, Boxes, PackageCheck, ArrowDownToLine, ArrowRight, TrendingUp, RefreshCw } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "Warehouse Overview" };

const WAREHOUSES = [
  { id: "wh1", name: "Dubai Main — Al Quoz",     type: "3PL",  utilization: 68, capacity: 5000, used: 3400, city: "Dubai",     country: "AE", active: true },
  { id: "wh2", name: "Riyadh Distribution Hub",   type: "OWN",  utilization: 54, capacity: 3000, used: 1620, city: "Riyadh",    country: "SA", active: true },
  { id: "wh3", name: "Abu Dhabi Cross-Dock",      type: "CROSS_DOCK", utilization: 82, capacity: 1500, used: 1230, city: "Abu Dhabi", country: "AE", active: true },
];

const AGING_INVENTORY = [
  { sku: "SH-X200",   product: "Safety Helmet Pro X200",     daysInStock: 92, qty: 45,  value: 4005, warehouse: "Dubai Main" },
  { sku: "CB-100",    product: "Cable Ties 100pc Bundle",    daysInStock: 78, qty: 200, value: 1800, warehouse: "Dubai Main" },
  { sku: "LED-T8-4F", product: "LED Tube 4ft 18W (10 pack)",daysInStock: 65, qty: 120, value: 9600, warehouse: "Riyadh Hub" },
];

const QUICK_STATS = [
  { label: "Inbound Shipments",  value: MOCK_WAREHOUSE_DATA.inboundShipments, icon: Truck,          color: "text-blue-600",   bg: "bg-blue-50 border-blue-200",   href: "/warehouse/inbound" },
  { label: "Pending Dispatch",   value: MOCK_WAREHOUSE_DATA.pendingDispatch,   icon: Clock,          color: "text-amber-600",  bg: "bg-amber-50 border-amber-200", href: "/warehouse/pickpack" },
  { label: "Low Stock SKUs",     value: MOCK_WAREHOUSE_DATA.lowStockAlerts.length, icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50 border-red-200",    href: "/warehouse/stock?filter=low" },
  { label: "Total SKUs Tracked", value: 847,                                   icon: Boxes,          color: "text-purple-600", bg: "bg-white border-border",       href: "/warehouse/stock" },
];

export default async function WarehousePage() {
  await requireAdminSession();
  const data = MOCK_WAREHOUSE_DATA;

  return (
    <AdminLayout>
      <div className="space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">Warehouse Overview</h1>
            <p className="text-muted-foreground text-sm">{WAREHOUSES.length} warehouses · Stock, inbound, fulfillment</p>
          </div>
          <div className="flex gap-2">
            <Link href="/warehouse/inbound" className="flex items-center gap-1.5 text-sm bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl font-semibold transition-colors">
              <ArrowDownToLine className="h-3.5 w-3.5" /> Receive Goods
            </Link>
            <Link href="/warehouse/pickpack" className="flex items-center gap-1.5 text-sm border border-border bg-white text-slate-700 hover:bg-slate-50 px-4 py-2 rounded-xl font-medium transition-colors">
              <PackageCheck className="h-3.5 w-3.5" /> Pick/Pack
            </Link>
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {QUICK_STATS.map(({ label, value, icon: Icon, color, bg, href }) => (
            <Link key={label} href={href} className={`rounded-2xl border p-4 hover:shadow-sm transition-all ${bg}`}>
              <Icon className={`h-4 w-4 ${color} mb-2`} />
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
              <p className={`text-xs ${color} mt-1 flex items-center gap-0.5 font-medium`}>View <ArrowRight className="h-3 w-3" /></p>
            </Link>
          ))}
        </div>

        {/* Low stock alert banner */}
        {data.lowStockAlerts.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
              <div>
                <p className="font-semibold text-red-800 text-sm">{data.lowStockAlerts.length} SKUs below reorder point</p>
                <p className="text-xs text-red-600">{data.lowStockAlerts.map(a => a.sku).join(", ")}</p>
              </div>
            </div>
            <Link href="/warehouse/stock?filter=low" className="text-xs bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 font-medium transition-colors whitespace-nowrap">
              Replenish →
            </Link>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Warehouse cards */}
          <div className="bg-white rounded-2xl border border-border overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h2 className="font-semibold">Warehouses</h2>
              <span className="text-xs text-muted-foreground">{WAREHOUSES.length} locations</span>
            </div>
            <div className="divide-y divide-border">
              {WAREHOUSES.map((wh) => {
                const pct = wh.utilization;
                const barColor = pct >= 85 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-green-500";
                const textColor = pct >= 85 ? "text-red-600" : pct >= 70 ? "text-amber-600" : "text-green-600";
                return (
                  <div key={wh.id} className="px-5 py-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-semibold text-sm">{wh.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-muted-foreground">{wh.city}, {wh.country}</span>
                          <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">{wh.type}</span>
                        </div>
                      </div>
                      <span className={`text-sm font-bold ${textColor}`}>{pct}%</span>
                    </div>
                    <div className="flex gap-0.5 h-2 mb-1.5">
                      {Array.from({ length: 10 }).map((_, i) => (
                        <div key={i} className={`flex-1 rounded-full ${i < Math.floor(pct / 10) ? barColor : "bg-gray-100"}`} />
                      ))}
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{wh.used.toLocaleString()} / {wh.capacity.toLocaleString()} sqm used</span>
                      <span className={pct >= 85 ? "text-red-600 font-medium" : ""}>{wh.capacity - wh.used} sqm free</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Stock by category */}
          <div className="bg-white rounded-2xl border border-border overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart2 className="h-4 w-4 text-blue-500" />
                <h2 className="font-semibold">Stock by Category</h2>
              </div>
              <Link href="/warehouse/stock" className="text-xs text-blue-600 hover:underline font-medium">View All →</Link>
            </div>
            <div className="p-5 space-y-4">
              {data.stockByCategory.map((cat) => {
                const maxUnits = Math.max(...data.stockByCategory.map(c => c.units));
                const pct = Math.round((cat.units / maxUnits) * 100);
                const segments = Math.floor(pct / 10);
                return (
                  <div key={cat.category}>
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <span className="font-medium">{cat.category}</span>
                      <div className="flex items-center gap-3">
                        <span className="font-bold">{cat.units.toLocaleString()}</span>
                        <span className="text-xs text-muted-foreground">AED {(cat.value / 1000).toFixed(0)}k</span>
                      </div>
                    </div>
                    <div className="flex gap-0.5 h-2">
                      {Array.from({ length: 10 }).map((_, i) => (
                        <div key={i} className={`flex-1 rounded-full ${i < segments ? "bg-blue-500" : "bg-gray-100"}`} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="px-5 py-3 border-t border-border bg-slate-50">
              <p className="text-xs text-muted-foreground">
                Total stock value: <strong className="text-slate-800">AED {(data.stockByCategory.reduce((s,c) => s+c.value, 0) / 1000).toFixed(0)}k</strong>
              </p>
            </div>
          </div>
        </div>

        {/* Aging inventory */}
        <div className="bg-white rounded-2xl border border-border overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-amber-500" />
              <h2 className="font-semibold">Aging Inventory</h2>
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">Review recommended</span>
            </div>
            <Link href="/warehouse/stock?filter=aging" className="text-xs text-blue-600 hover:underline font-medium">View All →</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-border">
                <tr>
                  {["SKU","Product","Warehouse","Days in Stock","Qty","Value","Action"].map(h => (
                    <th key={h} className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {AGING_INVENTORY.map((item) => (
                  <tr key={item.sku} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-600">{item.sku}</td>
                    <td className="px-4 py-3 font-medium text-sm">{item.product}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{item.warehouse}</td>
                    <td className="px-4 py-3">
                      <span className={`text-sm font-bold ${item.daysInStock > 90 ? "text-red-600" : item.daysInStock > 60 ? "text-amber-600" : "text-slate-800"}`}>
                        {item.daysInStock}d
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium">{item.qty}</td>
                    <td className="px-4 py-3 text-sm font-medium">AED {item.value.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <button type="button" className="text-xs text-blue-600 hover:underline font-medium">Mark for Clearance</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick nav */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { href: "/warehouse/inbound",  label: "Inbound Goods",  icon: ArrowDownToLine, color: "text-blue-600",   bg: "hover:bg-blue-50 hover:border-blue-300" },
            { href: "/warehouse/stock",    label: "Stock Manager",  icon: Boxes,           color: "text-purple-600", bg: "hover:bg-purple-50 hover:border-purple-300" },
            { href: "/warehouse/pickpack", label: "Pick / Pack",    icon: PackageCheck,    color: "text-green-600",  bg: "hover:bg-green-50 hover:border-green-300" },
            { href: "/warehouse/pickpack?tab=dispatch", label: "Dispatch Queue", icon: Truck, color: "text-cyan-600", bg: "hover:bg-cyan-50 hover:border-cyan-300" },
          ].map(({ href, label, icon: Icon, color, bg }) => (
            <Link key={href} href={href}
              className={`flex items-center gap-3 bg-white rounded-2xl border border-border p-4 transition-all ${bg}`}>
              <Icon className={`h-5 w-5 ${color} shrink-0`} />
              <span className="text-sm font-medium">{label}</span>
              <ArrowRight className="h-4 w-4 text-muted-foreground ms-auto" />
            </Link>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
}
