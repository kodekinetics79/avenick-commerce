import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { formatCurrency } from "@avenick/utils";
import { ArrowLeft, Truck, CheckCircle, Clock, AlertTriangle, Package, ArrowDownToLine, Calendar } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "Inbound Goods" };

type InboundStatus = "SCHEDULED" | "IN_TRANSIT" | "ARRIVED" | "RECEIVING" | "RECEIVED" | "DISCREPANCY";

const MOCK_INBOUND: Array<{
  id: string; ref: string; supplier: string; warehouse: string;
  items: number; totalUnits: number; expectedValue: number; currency: string;
  carrier: string; trackingNumber: string; expectedArrival: string;
  status: InboundStatus; notes: string;
}> = [
  { id: "ib001", ref: "PO-2024-0091", supplier: "SafeGuard AE",       warehouse: "Dubai Main",  items: 3, totalUnits: 500, expectedValue: 21000, currency: "AED", carrier: "DHL",    trackingNumber: "DHL-AE-20241124-01",  expectedArrival: "Nov 26, 2024", status: "IN_TRANSIT",  notes: "" },
  { id: "ib002", ref: "PO-2024-0089", supplier: "Gulf Industrial Co",  warehouse: "Riyadh Hub",  items: 2, totalUnits: 200, expectedValue:  8400, currency: "AED", carrier: "Aramex", trackingNumber: "AX-SA-20241123-44",   expectedArrival: "Nov 27, 2024", status: "IN_TRANSIT",  notes: "" },
  { id: "ib003", ref: "PO-2024-0085", supplier: "FireShield LLC",      warehouse: "Dubai Main",  items: 1, totalUnits: 100, expectedValue:  4500, currency: "AED", carrier: "FedEx",  trackingNumber: "FX-DXB-20241125-09",  expectedArrival: "Nov 25, 2024", status: "ARRIVED",     notes: "Dock 3 — awaiting unloading crew" },
  { id: "ib004", ref: "PO-2024-0081", supplier: "Al Noor Trading Co",  warehouse: "Dubai Main",  items: 5, totalUnits: 800, expectedValue: 32000, currency: "AED", carrier: "Aramex", trackingNumber: "AX-DXB-20241120-17",  expectedArrival: "Nov 22, 2024", status: "DISCREPANCY", notes: "Short by 50 units on SKU NG-100B" },
  { id: "ib005", ref: "PO-2024-0079", supplier: "Office Solutions KW", warehouse: "Riyadh Hub",  items: 4, totalUnits: 300, expectedValue: 12600, currency: "AED", carrier: "DHL",    trackingNumber: "DHL-KW-20241118-88",  expectedArrival: "Nov 20, 2024", status: "RECEIVED",    notes: "" },
  { id: "ib006", ref: "PO-2024-0094", supplier: "Apex Procurement",    warehouse: "Abu Dhabi",   items: 2, totalUnits: 150, expectedValue:  7200, currency: "AED", carrier: "Fetchr", trackingNumber: "FE-AUH-20241128-22",  expectedArrival: "Dec 1, 2024",  status: "SCHEDULED",   notes: "" },
];

const STATUS_CONFIG: Record<InboundStatus, { label: string; color: string; icon: typeof CheckCircle; border: string }> = {
  SCHEDULED:   { label: "Scheduled",   color: "bg-slate-100 text-muted-foreground",  icon: Calendar,      border: "border-border" },
  IN_TRANSIT:  { label: "In Transit",  color: "bg-blue-100 text-primary",    icon: Truck,          border: "border-border" },
  ARRIVED:     { label: "Arrived",     color: "bg-amber-100 text-amber-700",  icon: Package,        border: "border-amber-200" },
  RECEIVING:   { label: "Receiving",   color: "bg-purple-100 text-purple-700",icon: ArrowDownToLine, border: "border-border" },
  RECEIVED:    { label: "Received",    color: "bg-green-100 text-green-700",  icon: CheckCircle,    border: "border-border" },
  DISCREPANCY: { label: "Discrepancy", color: "bg-red-100 text-red-700",      icon: AlertTriangle,  border: "border-red-200" },
};

const TABS: { value: string; label: string }[] = [
  { value: "",             label: "All" },
  { value: "SCHEDULED",   label: "Scheduled" },
  { value: "IN_TRANSIT",  label: "In Transit" },
  { value: "ARRIVED",     label: "Arrived" },
  { value: "RECEIVED",    label: "Received" },
  { value: "DISCREPANCY", label: "Discrepancies" },
];

export default async function InboundPage({ searchParams }: { searchParams: { status?: string } }) {
  await requireAdminSession();
  const activeTab = searchParams.status ?? "";
  const filtered = activeTab ? MOCK_INBOUND.filter(i => i.status === activeTab) : MOCK_INBOUND;

  const inTransitCount  = MOCK_INBOUND.filter(i => i.status === "IN_TRANSIT").length;
  const arrivedCount    = MOCK_INBOUND.filter(i => i.status === "ARRIVED").length;
  const discrepancies   = MOCK_INBOUND.filter(i => i.status === "DISCREPANCY").length;
  const totalValue      = MOCK_INBOUND.reduce((s, i) => s + i.expectedValue, 0);

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link href="/warehouse" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                <ArrowLeft className="h-3.5 w-3.5" /> Warehouse
              </Link>
              <span className="text-muted-foreground">/</span>
              <span className="text-sm font-medium">Inbound Goods</span>
            </div>
            <h1 className="text-2xl font-bold">Inbound Goods</h1>
            <p className="text-sm text-muted-foreground">Track incoming shipments and receive goods into warehouse</p>
          </div>
          <button type="button" className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
            <ArrowDownToLine className="h-3.5 w-3.5" /> Receive Goods
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "In Transit",     value: inTransitCount, color: "text-primary",   bg: "bg-blue-50 border-blue-200" },
            { label: "Arrived / Dock", value: arrivedCount,   color: "text-amber-600",  bg: arrivedCount > 0 ? "bg-amber-50 border-amber-200" : "bg-white border-border" },
            { label: "Discrepancies",  value: discrepancies,  color: "text-red-600",    bg: discrepancies > 0 ? "bg-red-50 border-red-200" : "bg-white border-border" },
            { label: "Expected Value", value: formatCurrency(totalValue, "AED"), color: "text-green-700", bg: "bg-green-50 border-green-200" },
          ].map(({ label, value, color, bg }) => (
            <div key={label} className={`rounded-2xl border p-4 ${bg}`}>
              <p className={`text-xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Discrepancy alert */}
        {discrepancies > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-800 text-sm">{discrepancies} inbound shipment{discrepancies !== 1 ? "s have" : " has"} discrepancies</p>
              <p className="text-xs text-red-600">Review short/over-deliveries and raise supplier claims as needed.</p>
            </div>
          </div>
        )}

        {/* Arrived alert */}
        {arrivedCount > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Package className="h-5 w-5 text-amber-600 shrink-0" />
              <div>
                <p className="font-semibold text-amber-800 text-sm">{arrivedCount} shipment{arrivedCount !== 1 ? "s" : ""} arrived at dock — awaiting receiving</p>
                <p className="text-xs text-amber-600">Start receiving to update stock levels.</p>
              </div>
            </div>
            <button type="button" className="text-xs bg-amber-600 text-white px-3 py-1.5 rounded-lg hover:bg-amber-700 font-medium transition-colors whitespace-nowrap">
              Start Receiving →
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {TABS.map(({ value, label }) => {
            const count = value ? MOCK_INBOUND.filter(i => i.status === value).length : MOCK_INBOUND.length;
            return (
              <Link key={value} href={value ? `/warehouse/inbound?status=${value}` : "/warehouse/inbound"}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${activeTab === value ? "bg-slate-900 text-white" : "bg-white border border-border text-muted-foreground hover:border-slate-400 hover:text-foreground"}`}>
                {label}
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${activeTab === value ? "bg-white/20" : "bg-slate-100 text-muted-foreground"}`}>{count}</span>
              </Link>
            );
          })}
        </div>

        {/* Shipments table */}
        <div className="bg-white rounded-2xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-border">
                <tr>
                  {["PO Ref","Supplier","Warehouse","Items","Units","Est. Value","Carrier / Tracking","Expected","Status","Action"].map(h => (
                    <th key={h} className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((item) => {
                  const sc = STATUS_CONFIG[item.status];
                  const StatusIcon = sc.icon;
                  return (
                    <tr key={item.id} className={`hover:bg-slate-50 transition-colors ${item.status === "DISCREPANCY" ? "bg-red-50/30" : item.status === "ARRIVED" ? "bg-amber-50/30" : ""}`}>
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-primary">{item.ref}</td>
                      <td className="px-4 py-3 font-medium text-sm">{item.supplier}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{item.warehouse}</td>
                      <td className="px-4 py-3 text-sm text-center font-medium">{item.items}</td>
                      <td className="px-4 py-3 text-sm font-medium">{item.totalUnits.toLocaleString()}</td>
                      <td className="px-4 py-3 font-bold text-green-700 text-sm">{formatCurrency(item.expectedValue, item.currency as "AED")}</td>
                      <td className="px-4 py-3">
                        <p className="text-xs text-muted-foreground">{item.carrier}</p>
                        <p className="font-mono text-xs text-muted-foreground">{item.trackingNumber}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{item.expectedArrival}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${sc.color}`}>
                          <StatusIcon className="h-3 w-3" /> {sc.label}
                        </span>
                        {item.notes && <p className="text-[10px] text-muted-foreground mt-0.5 max-w-[150px] line-clamp-1">{item.notes}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          {item.status === "ARRIVED" && (
                            <button type="button" className="text-xs bg-green-600 text-white px-2.5 py-1 rounded-lg hover:bg-green-700 font-medium transition-colors">Receive</button>
                          )}
                          {item.status === "IN_TRANSIT" && (
                            <button type="button" className="text-xs border border-border text-muted-foreground px-2.5 py-1 rounded-lg hover:bg-slate-50 font-medium transition-colors">Track</button>
                          )}
                          {item.status === "DISCREPANCY" && (
                            <button type="button" className="text-xs bg-red-500 text-white px-2.5 py-1 rounded-lg hover:bg-red-600 font-medium transition-colors">Resolve</button>
                          )}
                          {item.status === "RECEIVED" && (
                            <span className="text-xs text-green-600 font-medium flex items-center gap-0.5"><CheckCircle className="h-3 w-3" /> Done</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="text-center py-16">
                <Truck className="h-10 w-10 mx-auto text-slate-200 mb-3" />
                <p className="font-semibold text-muted-foreground">No inbound shipments</p>
              </div>
            )}
          </div>
          <div className="px-4 py-3 border-t border-border bg-slate-50">
            <p className="text-xs text-muted-foreground">{filtered.length} of {MOCK_INBOUND.length} shipments shown</p>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
