"use client";

import { notFound } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import {
  CheckCircle, Package, Truck, Home, AlertCircle, ArrowLeft,
  MapPin, RotateCcw, Copy, ExternalLink, ShieldCheck, FileText,
} from "lucide-react";
import { MainLayout } from "@/components/layout/main-layout";
import { MOCK_ORDERS } from "@avenick/database";

const ALL_STEPS = [
  { status: "CONFIRMED",  label: "Order Confirmed",  icon: CheckCircle, desc: "Payment received and order confirmed." },
  { status: "PROCESSING", label: "Processing",        icon: Package,     desc: "Supplier is preparing your items." },
  { status: "SHIPPED",    label: "Shipped",           icon: Truck,       desc: "Order is on its way to you." },
  { status: "DELIVERED",  label: "Delivered",         icon: Home,        desc: "Order delivered successfully." },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  CONFIRMED:   { label: "Confirmed",  color: "text-primary",   bg: "bg-blue-100" },
  PROCESSING:  { label: "Processing", color: "text-purple-700", bg: "bg-purple-100" },
  SHIPPED:     { label: "Shipped",    color: "text-cyan-700",   bg: "bg-cyan-100" },
  DELIVERED:   { label: "Delivered",  color: "text-primary",  bg: "bg-primary/20" },
  CANCELLED:   { label: "Cancelled",  color: "text-red-700",    bg: "bg-red-100" },
};

const MOCK_TRACKING = {
  carrier: "Aramex", trackingNumber: "AX-UAE-20241122-001",
  events: [
    { date: "Nov 17, 2:45 PM", location: "Dubai, UAE",  desc: "Delivered to recipient" },
    { date: "Nov 17, 9:00 AM", location: "Dubai, UAE",  desc: "Out for delivery" },
    { date: "Nov 16, 8:30 PM", location: "Dubai, UAE",  desc: "Arrived at delivery facility" },
    { date: "Nov 16, 10:00 AM", location: "Dubai, UAE", desc: "Shipment picked up" },
  ],
};

export default function OrderDetailPage({ params }: { params: { id: string } }) {
  const order = MOCK_ORDERS.find((o) => o.id === params.id);
  if (!order) notFound();

  const [copied, setCopied] = useState(false);
  const [showTracking, setShowTracking] = useState(false);

  const reachedStatuses = order.timeline.map((t) => t.status);
  const subtotal = order.items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  const vat = subtotal * 0.05;
  const sc = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.CONFIRMED;
  const isDelivered = order.status === "DELIVERED";
  const isShipped   = order.status === "SHIPPED" || isDelivered;

  function copyTracking() {
    navigator.clipboard.writeText(MOCK_TRACKING.trackingNumber).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <MainLayout>
      <div className="bg-slate-50 min-h-screen">
        <div className="max-w-3xl mx-auto px-4 py-8">

          <Link href="/account/orders" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back to My Orders
          </Link>

          {/* Header */}
          <div className="bg-white rounded-2xl border border-border p-5 mb-5">
            <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-xl font-bold">{order.orderNumber}</h1>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${sc.bg} ${sc.color}`}>{sc.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${order.type === "B2B" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-primary"}`}>{order.type}</span>
                </div>
                <p className="text-sm text-muted-foreground">Placed on {order.createdAt}</p>
              </div>
              <div className="text-end">
                <p className="text-2xl font-bold text-primary">AED {order.total.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">incl. VAT</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center text-sm">
              {[
                { label: "Items",    value: String(order.items.length) },
                { label: "Payment",  value: order.type === "B2B" ? "Net 30" : "Paid" },
                { label: "Delivery", value: isDelivered ? "Delivered" : "In Transit" },
              ].map(({ label, value }) => (
                <div key={label} className="bg-slate-50 rounded-xl p-2.5">
                  <p className="font-bold">{value}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Tracking */}
          {isShipped && (
            <div className="bg-white rounded-2xl border border-border p-5 mb-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Truck className="h-4 w-4 text-cyan-600" />
                  <h2 className="font-semibold">Shipment Tracking</h2>
                </div>
                <button type="button" onClick={() => setShowTracking(v => !v)} className="text-xs text-primary hover:underline font-medium">
                  {showTracking ? "Hide" : "Show"} Timeline
                </button>
              </div>
              <div className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3 mb-3">
                <div>
                  <p className="text-xs text-muted-foreground">{MOCK_TRACKING.carrier}</p>
                  <p className="font-mono text-sm font-semibold text-foreground">{MOCK_TRACKING.trackingNumber}</p>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={copyTracking} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground border border-border px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition-colors">
                    <Copy className="h-3 w-3" /> {copied ? "Copied!" : "Copy"}
                  </button>
                  <button type="button" className="flex items-center gap-1 text-xs bg-cyan-600 text-white px-2.5 py-1.5 rounded-lg hover:bg-cyan-700 transition-colors font-medium">
                    <ExternalLink className="h-3 w-3" /> Track Live
                  </button>
                </div>
              </div>
              {showTracking && (
                <div className="space-y-3 pt-3 border-t border-border">
                  {MOCK_TRACKING.events.map((ev, i) => (
                    <div key={i} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 ${i === 0 ? "bg-primary/100" : "bg-slate-200"}`}>
                          {i === 0 ? <CheckCircle className="h-3.5 w-3.5 text-white" /> : <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />}
                        </div>
                        {i < MOCK_TRACKING.events.length - 1 && <div className="w-0.5 h-6 bg-slate-200 mt-1" />}
                      </div>
                      <div className="pb-2">
                        <p className={`text-sm font-medium ${i === 0 ? "text-primary" : "text-muted-foreground"}`}>{ev.desc}</p>
                        <p className="text-xs text-muted-foreground">{ev.date} · {ev.location}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Order status timeline */}
          <div className="bg-white rounded-2xl border border-border p-5 mb-5">
            <h2 className="font-semibold mb-5">Order Status</h2>
            <div>
              {ALL_STEPS.map((step, idx) => {
                const isReached = reachedStatuses.includes(step.status);
                const isCurrent = order.status === step.status;
                const isFuture  = !isReached && !isCurrent;
                const isLast    = idx === ALL_STEPS.length - 1;
                const Icon      = step.icon;
                const entry     = order.timeline.find((t) => t.status === step.status);
                return (
                  <div key={step.status} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${isReached ? "bg-primary/100 shadow-sm shadow-primary/30" : isCurrent ? "bg-primary ring-4 ring-blue-100" : "bg-slate-100"}`}>
                        <Icon className={`h-4 w-4 ${isReached || isCurrent ? "text-white" : "text-muted-foreground"}`} />
                      </div>
                      {!isLast && <div className={`w-0.5 h-10 my-0.5 ${isReached ? "bg-primary/40" : "bg-slate-100"}`} />}
                    </div>
                    <div className={`pb-8 flex-1 ${isLast ? "pb-0" : ""}`}>
                      <div className="flex items-start justify-between">
                        <div>
                          <p className={`font-semibold text-sm ${isFuture ? "text-muted-foreground" : ""}`}>
                            {step.label}
                            {isCurrent && <span className="ms-2 text-[10px] bg-blue-100 text-primary px-1.5 py-0.5 rounded-full font-bold uppercase">Current</span>}
                          </p>
                          <p className={`text-xs mt-0.5 ${isFuture ? "text-slate-300" : "text-muted-foreground"}`}>
                            {entry ? entry.date : isFuture ? "Upcoming" : step.desc}
                          </p>
                        </div>
                        {isReached && <CheckCircle className="h-4 w-4 text-primary/100 shrink-0 mt-0.5" />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Items */}
          <div className="bg-white rounded-2xl border border-border overflow-hidden mb-5">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="font-semibold">Items ({order.items.length})</h2>
            </div>
            <div className="divide-y divide-border">
              {order.items.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center text-lg shrink-0">📦</div>
                    <div>
                      <p className="text-sm font-medium">{item.nameEn}</p>
                      <p className="text-xs text-muted-foreground">Qty: {item.quantity} × AED {item.unitPrice.toFixed(2)}</p>
                    </div>
                  </div>
                  <p className="font-bold text-sm text-primary">AED {(item.quantity * item.unitPrice).toFixed(2)}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Delivery + Summary grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
            <div className="bg-white rounded-2xl border border-border p-5">
              <div className="flex items-center gap-2 mb-3">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <h2 className="font-semibold text-sm">Delivery Address</h2>
              </div>
              <p className="text-sm font-medium">{order.shippingAddress.line1}</p>
              <p className="text-sm text-muted-foreground">{order.shippingAddress.city}, {order.shippingAddress.country}</p>
            </div>
            <div className="bg-white rounded-2xl border border-border p-5">
              <h2 className="font-semibold text-sm mb-3">Summary</h2>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>AED {subtotal.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">VAT (5%)</span><span>AED {vat.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Shipping</span><span className="text-primary font-medium">Free</span></div>
                <div className="flex justify-between font-bold text-base pt-2 border-t border-border">
                  <span>Total</span><span className="text-primary">AED {order.total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            {isDelivered && (
              <Link href="/returns" className="flex-1 flex items-center justify-center gap-2 bg-white border border-border text-muted-foreground hover:border-primary/40 hover:text-primary font-medium px-4 py-2.5 rounded-xl text-sm transition-colors">
                <RotateCcw className="h-4 w-4" /> Return / Exchange
              </Link>
            )}
            <Link href="/support" className="flex-1 flex items-center justify-center gap-2 bg-white border border-border text-muted-foreground hover:border-red-300 hover:text-red-600 font-medium px-4 py-2.5 rounded-xl text-sm transition-colors">
              <AlertCircle className="h-4 w-4" /> Report Issue
            </Link>
            <button type="button" className="flex-1 flex items-center justify-center gap-2 bg-white border border-border text-muted-foreground hover:border-slate-400 font-medium px-4 py-2.5 rounded-xl text-sm transition-colors">
              <FileText className="h-4 w-4" /> Download Invoice
            </button>
          </div>

          <div className="mt-5 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-primary/100" />
            Protected by Avenick Commerce Buyer Protection
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
