import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { formatCurrency } from "@avenick/utils";
import { ArrowLeft, Package, PackageCheck, Truck, Clock, AlertTriangle, CheckCircle, MapPin, User } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "Pick / Pack / Dispatch" };

type FulfillmentStatus = "PICK_PENDING" | "PICKING" | "PICKED" | "PACKING" | "PACKED" | "DISPATCHED";

const MOCK_FULFILLMENT: Array<{
  id: string; orderNumber: string; buyer: string; type: "B2C" | "B2B";
  items: number; totalUnits: number; value: number; currency: string;
  warehouse: string; destination: string; carrier: string;
  priority: "URGENT" | "NORMAL"; dueBy: string;
  status: FulfillmentStatus; assignedTo: string;
}> = [
  { id: "f001", orderNumber: "ORD-2024-0831", buyer: "Gulf Industrial Supplies",  type: "B2B", items: 3, totalUnits: 200, value: 8400,  currency: "AED", warehouse: "Dubai Main", destination: "Abu Dhabi, AE", carrier: "Aramex", priority: "URGENT",  dueBy: "Today 3pm",    status: "PICKING",     assignedTo: "Ali Hassan" },
  { id: "f002", orderNumber: "ORD-2024-0829", buyer: "Sarah Al-Mansouri",         type: "B2C", items: 2, totalUnits:   4, value:   534, currency: "AED", warehouse: "Dubai Main", destination: "Dubai, AE",     carrier: "Fetchr",  priority: "NORMAL",  dueBy: "Today 5pm",    status: "PICK_PENDING",assignedTo: "" },
  { id: "f003", orderNumber: "ORD-2024-0825", buyer: "Apex Procurement FZCO",    type: "B2B", items: 2, totalUnits:  50, value: 5600,  currency: "AED", warehouse: "Dubai Main", destination: "JAFZA, Dubai",  carrier: "DHL",     priority: "NORMAL",  dueBy: "Tomorrow 12pm",status: "PACKED",      assignedTo: "Khalid Omar" },
  { id: "f004", orderNumber: "ORD-2024-0822", buyer: "Al Noor Trading Co",       type: "B2B", items: 1, totalUnits: 100, value: 3200,  currency: "AED", warehouse: "Riyadh Hub", destination: "Riyadh, SA",    carrier: "Aramex", priority: "URGENT",  dueBy: "Today 2pm",    status: "PICK_PENDING",assignedTo: "" },
  { id: "f005", orderNumber: "ORD-2024-0819", buyer: "Khalid Al Rashid",         type: "B2C", items: 1, totalUnits:   2, value:   178, currency: "AED", warehouse: "Dubai Main", destination: "Sharjah, AE",   carrier: "Fetchr", priority: "NORMAL",  dueBy: "Nov 26",       status: "DISPATCHED",  assignedTo: "Ali Hassan" },
  { id: "f006", orderNumber: "ORD-2024-0817", buyer: "Kuwait Office Solutions",  type: "B2B", items: 4, totalUnits:  30, value: 10500, currency: "AED", warehouse: "Riyadh Hub", destination: "Kuwait City, KW",carrier: "DHL",    priority: "NORMAL",  dueBy: "Nov 27",       status: "PICKING",     assignedTo: "Fatima Hassan" },
];

const STATUS_CONFIG: Record<FulfillmentStatus, { label: string; color: string; icon: typeof Package; stage: string }> = {
  PICK_PENDING: { label: "Pick Pending", color: "bg-slate-100 text-muted-foreground",  icon: Clock,         stage: "pick" },
  PICKING:      { label: "Picking",      color: "bg-blue-100 text-primary",    icon: Package,       stage: "pick" },
  PICKED:       { label: "Picked",       color: "bg-indigo-100 text-indigo-700",icon: CheckCircle,   stage: "pack" },
  PACKING:      { label: "Packing",      color: "bg-purple-100 text-purple-700",icon: PackageCheck,  stage: "pack" },
  PACKED:       { label: "Packed",       color: "bg-amber-100 text-amber-700",  icon: PackageCheck,  stage: "dispatch" },
  DISPATCHED:   { label: "Dispatched",   color: "bg-green-100 text-green-700",  icon: Truck,         stage: "done" },
};

const STAGE_TABS = [
  { value: "",         label: "All",      icon: Package },
  { value: "pick",     label: "Pick List", icon: Clock },
  { value: "pack",     label: "Pack Queue", icon: PackageCheck },
  { value: "dispatch", label: "Dispatch",   icon: Truck },
];

export default async function PickPackPage({ searchParams }: { searchParams: { tab?: string } }) {
  await requireAdminSession();

  const activeTab = searchParams.tab ?? "";
  const filtered = activeTab
    ? MOCK_FULFILLMENT.filter(f => STATUS_CONFIG[f.status].stage === activeTab || (activeTab === "dispatch" && f.status === "DISPATCHED"))
    : MOCK_FULFILLMENT;

  const pickPendingCount = MOCK_FULFILLMENT.filter(f => ["PICK_PENDING","PICKING"].includes(f.status)).length;
  const packQueueCount   = MOCK_FULFILLMENT.filter(f => ["PICKED","PACKING"].includes(f.status)).length;
  const packedCount      = MOCK_FULFILLMENT.filter(f => f.status === "PACKED").length;
  const urgentCount      = MOCK_FULFILLMENT.filter(f => f.priority === "URGENT" && f.status !== "DISPATCHED").length;

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
              <span className="text-sm font-medium">Pick / Pack / Dispatch</span>
            </div>
            <h1 className="text-2xl font-bold">Pick / Pack / Dispatch</h1>
            <p className="text-sm text-muted-foreground">Fulfillment pipeline for outbound orders</p>
          </div>
          <button type="button" className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
            <Package className="h-3.5 w-3.5" /> Generate Pick List
          </button>
        </div>

        {/* Pipeline stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Pick Queue",    value: pickPendingCount, color: "text-primary",   bg: "bg-blue-50 border-blue-200",   tab: "pick" },
            { label: "Pack Queue",    value: packQueueCount,   color: "text-purple-600", bg: "bg-purple-50 border-purple-200", tab: "pack" },
            { label: "Ready to Ship", value: packedCount,      color: "text-amber-600",  bg: packedCount > 0 ? "bg-amber-50 border-amber-200" : "bg-white border-border", tab: "dispatch" },
            { label: "Urgent Orders", value: urgentCount,      color: urgentCount > 0 ? "text-red-600" : "text-muted-foreground", bg: urgentCount > 0 ? "bg-red-50 border-red-200" : "bg-white border-border", tab: "" },
          ].map(({ label, value, color, bg, tab }) => (
            <Link key={label} href={tab ? `/warehouse/pickpack?tab=${tab}` : "/warehouse/pickpack"}
              className={`rounded-2xl border p-4 hover:shadow-sm transition-all ${bg}`}>
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </Link>
          ))}
        </div>

        {/* Urgent alert */}
        {urgentCount > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
            <p className="font-semibold text-red-800 text-sm">{urgentCount} urgent order{urgentCount !== 1 ? "s" : ""} pending fulfillment — prioritize immediately</p>
          </div>
        )}

        {/* Pipeline visual */}
        <div className="bg-white rounded-2xl border border-border p-5">
          <h2 className="font-semibold mb-4 text-sm text-muted-foreground uppercase tracking-wide">Fulfillment Pipeline</h2>
          <div className="flex items-center gap-0 overflow-x-auto">
            {[
              { label: "Pick Pending", count: MOCK_FULFILLMENT.filter(f=>f.status==="PICK_PENDING").length, icon: Clock,         color: "bg-slate-100 text-muted-foreground", border: "border-border" },
              { label: "Picking",      count: MOCK_FULFILLMENT.filter(f=>f.status==="PICKING").length,      icon: Package,       color: "bg-blue-100 text-primary",   border: "border-blue-200" },
              { label: "Picked",       count: MOCK_FULFILLMENT.filter(f=>f.status==="PICKED").length,       icon: CheckCircle,   color: "bg-indigo-100 text-indigo-700",border: "border-indigo-200" },
              { label: "Packing",      count: MOCK_FULFILLMENT.filter(f=>f.status==="PACKING").length,      icon: PackageCheck,  color: "bg-purple-100 text-purple-700",border: "border-purple-200" },
              { label: "Packed",       count: MOCK_FULFILLMENT.filter(f=>f.status==="PACKED").length,       icon: PackageCheck,  color: "bg-amber-100 text-amber-700",  border: "border-amber-200" },
              { label: "Dispatched",   count: MOCK_FULFILLMENT.filter(f=>f.status==="DISPATCHED").length,   icon: Truck,         color: "bg-green-100 text-green-700",  border: "border-green-200" },
            ].map(({ label, count, icon: Icon, color, border }, i, arr) => (
              <div key={label} className="flex items-center shrink-0">
                <div className={`flex flex-col items-center border ${border} rounded-xl px-4 py-3 min-w-[90px] text-center ${color}`}>
                  <Icon className="h-5 w-5 mb-1" />
                  <p className="text-xl font-bold">{count}</p>
                  <p className="text-[10px] font-medium mt-0.5 leading-tight">{label}</p>
                </div>
                {i < arr.length - 1 && <div className="w-6 h-0.5 bg-slate-200 shrink-0" />}
              </div>
            ))}
          </div>
        </div>

        {/* Stage tabs */}
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {STAGE_TABS.map(({ value, label, icon: Icon }) => (
            <Link key={value} href={value ? `/warehouse/pickpack?tab=${value}` : "/warehouse/pickpack"}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${activeTab === value ? "bg-slate-900 text-white" : "bg-white border border-border text-muted-foreground hover:border-slate-400 hover:text-foreground"}`}>
              <Icon className="h-3.5 w-3.5" /> {label}
            </Link>
          ))}
        </div>

        {/* Orders table */}
        <div className="space-y-3">
          {filtered.map((order) => {
            const sc = STATUS_CONFIG[order.status];
            const StatusIcon = sc.icon;
            const isUrgent = order.priority === "URGENT";
            return (
              <div key={order.id} className={`bg-white rounded-2xl border-2 p-4 ${isUrgent && order.status !== "DISPATCHED" ? "border-red-200" : "border-border"}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Top row */}
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-mono text-xs font-semibold text-muted-foreground">{order.orderNumber}</span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${sc.color}`}>
                        <StatusIcon className="h-3 w-3" /> {sc.label}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${order.type === "B2B" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-primary"}`}>{order.type}</span>
                      {isUrgent && order.status !== "DISPATCHED" && (
                        <span className="flex items-center gap-0.5 text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-bold uppercase">
                          <AlertTriangle className="h-2.5 w-2.5" /> URGENT
                        </span>
                      )}
                    </div>

                    {/* Details row */}
                    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                      <span className="font-medium text-muted-foreground">{order.buyer}</span>
                      <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {order.destination}</span>
                      <span className="flex items-center gap-1"><Package className="h-3 w-3" /> {order.items} items · {order.totalUnits} units</span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Due: <strong className={isUrgent ? "text-red-600" : "text-muted-foreground"}>{order.dueBy}</strong></span>
                      <span>{order.carrier} · {order.warehouse}</span>
                      {order.assignedTo && <span className="flex items-center gap-1"><User className="h-3 w-3" /> {order.assignedTo}</span>}
                    </div>
                  </div>

                  {/* Right side */}
                  <div className="text-end shrink-0">
                    <p className="font-bold text-green-700">{formatCurrency(order.value, order.currency as "AED")}</p>
                    <div className="flex gap-2 justify-end mt-2">
                      {order.status === "PICK_PENDING" && (
                        <button type="button" className="text-xs bg-primary text-white px-3 py-1.5 rounded-lg hover:bg-primary font-medium transition-colors">Start Picking</button>
                      )}
                      {order.status === "PICKING" && (
                        <button type="button" className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 font-medium transition-colors">Mark Picked</button>
                      )}
                      {(order.status === "PICKED" || order.status === "PACKING") && (
                        <button type="button" className="text-xs bg-purple-600 text-white px-3 py-1.5 rounded-lg hover:bg-purple-700 font-medium transition-colors">Mark Packed</button>
                      )}
                      {order.status === "PACKED" && (
                        <button type="button" className="text-xs bg-amber-600 text-white px-3 py-1.5 rounded-lg hover:bg-amber-700 font-medium transition-colors flex items-center gap-1">
                          <Truck className="h-3 w-3" /> Dispatch
                        </button>
                      )}
                      {order.status === "DISPATCHED" && (
                        <span className="text-xs text-green-600 font-medium flex items-center gap-1"><CheckCircle className="h-3.5 w-3.5" /> Dispatched</span>
                      )}
                      <button type="button" className="text-xs border border-border text-muted-foreground px-3 py-1.5 rounded-lg hover:bg-slate-50 font-medium transition-colors">View</button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="bg-white rounded-2xl border border-border p-16 text-center">
              <PackageCheck className="h-10 w-10 mx-auto text-slate-200 mb-3" />
              <p className="font-semibold text-muted-foreground">No orders in this queue</p>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
