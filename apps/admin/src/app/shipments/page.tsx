import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { formatCurrency } from "@avenick/utils";
import Link from "next/link";
import { Truck, CheckCircle, Clock, AlertTriangle, Package, MapPin } from "lucide-react";

export const metadata = { title: "Shipments" };

const SHIPMENTS = [
  { id: "s1", order: "ORD-2024-0831", supplier: "Gulf Industrial", buyer: "Apex Procurement", carrier: "Aramex", tracking: "AX-UAE-001", route: "Dubai → Abu Dhabi", status: "IN_TRANSIT", value: 8400, eta: "Nov 24" },
  { id: "s2", order: "ORD-2024-0829", supplier: "MediSafe Gulf", buyer: "Al Noor Trading", carrier: "DHL", tracking: "DHL-SA-448", route: "Dubai → Riyadh", status: "DELIVERED", value: 3200, eta: "Nov 22" },
  { id: "s3", order: "ORD-2024-0825", supplier: "SafeGuard AE", buyer: "Doha Facilities", carrier: "FedEx", tracking: "FX-QA-221", route: "Dubai → Doha", status: "PENDING_PICKUP", value: 5600, eta: "Nov 25" },
  { id: "s4", order: "ORD-2024-0817", supplier: "FireShield LLC", buyer: "Sharjah Safety", carrier: "Fetchr", tracking: "FE-SHJ-317", route: "Dubai → Sharjah", status: "EXCEPTION", value: 2800, eta: "Overdue" },
];

const STATUS: Record<string, { label: string; color: string; icon: typeof Truck }> = {
  PENDING_PICKUP: { label: "Pending Pickup", color: "bg-amber-100 text-amber-700", icon: Clock },
  IN_TRANSIT:     { label: "In Transit",     color: "bg-blue-100 text-blue-700",   icon: Truck },
  DELIVERED:      { label: "Delivered",      color: "bg-green-100 text-green-700", icon: CheckCircle },
  EXCEPTION:      { label: "Exception",      color: "bg-red-100 text-red-700",     icon: AlertTriangle },
};

export default async function ShipmentsPage() {
  await requireAdminSession();
  const exceptions = SHIPMENTS.filter((s) => s.status === "EXCEPTION").length;
  const inTransit = SHIPMENTS.filter((s) => s.status === "IN_TRANSIT").length;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Shipments</h1>
            <p className="text-sm text-muted-foreground">Marketplace-wide outbound shipment oversight</p>
          </div>
          <Link href="/warehouse/pickpack?tab=dispatch" className="flex items-center gap-1.5 bg-card border border-border text-foreground text-sm font-medium px-4 py-2 rounded-xl hover:bg-secondary transition-colors">
            <Package className="h-3.5 w-3.5" /> Dispatch Queue
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Pending Pickup", value: SHIPMENTS.filter((s) => s.status === "PENDING_PICKUP").length, color: "text-amber-600", bg: "bg-amber-50 border-amber-200" },
            { label: "In Transit", value: inTransit, color: "text-blue-600", bg: "bg-blue-50 border-blue-200" },
            { label: "Delivered", value: SHIPMENTS.filter((s) => s.status === "DELIVERED").length, color: "text-green-600", bg: "bg-white border-border" },
            { label: "Exceptions", value: exceptions, color: exceptions > 0 ? "text-red-600" : "text-slate-500", bg: exceptions > 0 ? "bg-red-50 border-red-200" : "bg-white border-border" },
          ].map((s) => (
            <div key={s.label} className={`rounded-2xl border p-4 ${s.bg}`}>
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {exceptions > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
            <p className="font-semibold text-red-800 text-sm">{exceptions} shipment exception{exceptions !== 1 ? "s" : ""} need resolution to avoid order disputes.</p>
          </div>
        )}

        <div className="bg-card rounded-2xl border border-border shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50 border-b border-border">
                <tr>{["Order", "Supplier", "Buyer", "Carrier", "Route", "Value", "Status", "ETA"].map((h) => (
                  <th key={h} className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-border">
                {SHIPMENTS.map((s) => {
                  const sc = STATUS[s.status] ?? STATUS.IN_TRANSIT;
                  const StatusIcon = sc.icon;
                  return (
                    <tr key={s.id} className={`hover:bg-secondary/40 transition-colors ${s.status === "EXCEPTION" ? "bg-red-50/30" : ""}`}>
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-600">{s.order}</td>
                      <td className="px-4 py-3 font-medium">{s.supplier}</td>
                      <td className="px-4 py-3 text-muted-foreground">{s.buyer}</td>
                      <td className="px-4 py-3"><p className="text-xs">{s.carrier}</p><p className="font-mono text-xs text-muted-foreground">{s.tracking}</p></td>
                      <td className="px-4 py-3"><span className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" /> {s.route}</span></td>
                      <td className="px-4 py-3 font-bold text-green-700">{formatCurrency(s.value, "AED")}</td>
                      <td className="px-4 py-3"><span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${sc.color}`}><StatusIcon className="h-3 w-3" /> {sc.label}</span></td>
                      <td className={`px-4 py-3 text-xs font-medium ${s.eta === "Overdue" ? "text-red-600" : "text-muted-foreground"}`}>{s.eta}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
