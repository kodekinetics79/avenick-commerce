import { requireSellerSession } from "@/lib/auth";
import { SellerLayout } from "@/components/layout/seller-layout";
import { formatCurrency } from "@manzil/utils";
import { Truck, Package, CheckCircle, Clock, MapPin, AlertTriangle } from "lucide-react";

export const metadata = { title: "Shipments" };

const MOCK_SHIPMENTS = [
  { id: "sh001", orderNumber: "ORD-2024-0831", buyer: "Gulf Industrial Supplies LLC", items: 3, weight: "12 kg", carrier: "Aramex", trackingNumber: "AX-UAE-20241122-001", status: "IN_TRANSIT", origin: "Dubai, UAE", destination: "Abu Dhabi, UAE", shippedAt: "Nov 22, 2024", estimatedDelivery: "Nov 24, 2024", value: 8400 },
  { id: "sh002", orderNumber: "ORD-2024-0829", buyer: "Al Noor Trading Co", items: 1, weight: "5.5 kg", carrier: "DHL", trackingNumber: "DHL-KSA-20241120-448", status: "DELIVERED", origin: "Dubai, UAE", destination: "Riyadh, KSA", shippedAt: "Nov 20, 2024", estimatedDelivery: "Nov 22, 2024", value: 3200 },
  { id: "sh003", orderNumber: "ORD-2024-0825", buyer: "Apex Procurement FZCO", items: 2, weight: "8 kg", carrier: "FedEx", trackingNumber: "FX-AUH-20241118-221", status: "PENDING_PICKUP", origin: "Dubai, UAE", destination: "Abu Dhabi, UAE", shippedAt: "—", estimatedDelivery: "Nov 25, 2024", value: 5600 },
  { id: "sh004", orderNumber: "ORD-2024-0819", buyer: "Muscat Construction Supply", items: 5, weight: "28 kg", carrier: "Oman Post", trackingNumber: "OP-MCT-20241115-093", status: "DELIVERED", origin: "Dubai, UAE", destination: "Muscat, Oman", shippedAt: "Nov 15, 2024", estimatedDelivery: "Nov 19, 2024", value: 14200 },
  { id: "sh005", orderNumber: "ORD-2024-0817", buyer: "Sharjah Safety Systems", items: 2, weight: "6 kg", carrier: "Fetchr", trackingNumber: "FE-SHJ-20241114-317", status: "EXCEPTION", origin: "Dubai, UAE", destination: "Sharjah, UAE", shippedAt: "Nov 14, 2024", estimatedDelivery: "Nov 15, 2024", value: 2800 },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Truck; border: string }> = {
  PENDING_PICKUP: { label: "Pending Pickup",   color: "bg-amber-100 text-amber-700",  icon: Clock,         border: "border-amber-200" },
  IN_TRANSIT:     { label: "In Transit",       color: "bg-blue-100 text-blue-700",    icon: Truck,         border: "border-blue-200" },
  DELIVERED:      { label: "Delivered",        color: "bg-green-100 text-green-700",  icon: CheckCircle,   border: "border-green-200" },
  EXCEPTION:      { label: "Exception",        color: "bg-red-100 text-red-700",      icon: AlertTriangle, border: "border-red-200" },
};

export default async function ShipmentsPage() {
  const { seller } = await requireSellerSession();

  const inTransit    = MOCK_SHIPMENTS.filter(s => s.status === "IN_TRANSIT").length;
  const pendingPickup= MOCK_SHIPMENTS.filter(s => s.status === "PENDING_PICKUP").length;
  const delivered    = MOCK_SHIPMENTS.filter(s => s.status === "DELIVERED").length;
  const exceptions   = MOCK_SHIPMENTS.filter(s => s.status === "EXCEPTION").length;

  return (
    <SellerLayout sellerName={seller.businessNameEn} tier={seller.tier}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">Shipments</h1>
            <p className="text-sm text-muted-foreground">Track outbound shipments and delivery status</p>
          </div>
          <button type="button" className="bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors flex items-center gap-1.5">
            <Package className="h-3.5 w-3.5" /> Create Shipment
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Pending Pickup", value: pendingPickup, color: "text-amber-600", bg: "bg-amber-50 border-amber-200", icon: Clock },
            { label: "In Transit",     value: inTransit,     color: "text-blue-600",  bg: "bg-blue-50 border-blue-200",   icon: Truck },
            { label: "Delivered",      value: delivered,     color: "text-green-600", bg: "bg-green-50 border-green-200", icon: CheckCircle },
            { label: "Exceptions",     value: exceptions,    color: "text-red-600",   bg: "bg-red-50 border-red-200",     icon: AlertTriangle },
          ].map(({ label, value, color, bg, icon: Icon }) => (
            <div key={label} className={`rounded-2xl border p-4 ${bg}`}>
              <Icon className={`h-4 w-4 ${color} mb-2`} />
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Exception alert */}
        {exceptions > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-800 text-sm">{exceptions} shipment{exceptions !== 1 ? "s have" : " has"} an exception</p>
              <p className="text-xs text-red-700 mt-0.5">Review and take action to prevent order disputes.</p>
            </div>
          </div>
        )}

        {/* Shipment cards */}
        <div className="space-y-3">
          {MOCK_SHIPMENTS.map((s) => {
            const sc = STATUS_CONFIG[s.status] ?? STATUS_CONFIG.IN_TRANSIT!;
            const StatusIcon = sc.icon;
            return (
              <div key={s.id} className={`bg-white rounded-2xl border-2 p-5 ${s.status === "EXCEPTION" ? "border-red-200" : "border-border"}`}>
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="font-mono text-xs font-semibold text-slate-600">{s.orderNumber}</p>
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${sc.color}`}>
                        <StatusIcon className="h-3 w-3" /> {sc.label}
                      </span>
                    </div>
                    <p className="font-semibold text-sm">{s.buyer}</p>
                    <p className="text-xs text-muted-foreground">{s.items} item{s.items !== 1 ? "s" : ""} · {s.weight}</p>
                  </div>
                  <p className="font-bold text-green-700 shrink-0">{formatCurrency(s.value, "AED")}</p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm bg-slate-50 rounded-xl p-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Carrier</p>
                    <p className="font-semibold text-sm">{s.carrier}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Tracking #</p>
                    <p className="font-mono text-xs font-semibold text-blue-600">{s.trackingNumber}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Shipped</p>
                    <p className="font-medium text-sm">{s.shippedAt}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Est. Delivery</p>
                    <p className="font-medium text-sm">{s.estimatedDelivery}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    <span>{s.origin}</span>
                    <span>→</span>
                    <span>{s.destination}</span>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" className="text-xs text-blue-600 hover:underline font-medium">Track</button>
                    {s.status === "PENDING_PICKUP" && (
                      <button type="button" className="text-xs bg-green-600 text-white px-3 py-1 rounded-lg hover:bg-green-700 transition-colors font-medium">Mark Shipped</button>
                    )}
                    {s.status === "EXCEPTION" && (
                      <button type="button" className="text-xs bg-red-500 text-white px-3 py-1 rounded-lg hover:bg-red-600 transition-colors font-medium">Resolve Issue</button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </SellerLayout>
  );
}
