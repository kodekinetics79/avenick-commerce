"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ShoppingCart, Download, Package, Truck, CheckCircle, X, Loader2 } from "lucide-react";
import { formatCurrency } from "@avenick/utils";
import { useToast } from "@/components/toast";
import { bulkUpdateOrderStatus } from "@/app/orders/actions";

export type OrderRow = {
  id: string;
  orderNumber: string;
  buyer: string;
  company: string;
  date: string;
  itemCount: number;
  total: number;
  currency: string;
  type: string;
  status: string;
};

const STATUS_CLS: Record<string, string> = {
  PENDING_PAYMENT: "bg-secondary text-muted-foreground",
  CONFIRMED: "bg-primary/15 text-primary",
  PROCESSING: "bg-accent/15 text-accent",
  SHIPPED: "bg-primary/15 text-primary",
  OUT_FOR_DELIVERY: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  DELIVERED: "bg-success/15 text-success",
  CANCELLED: "bg-danger/15 text-danger",
  REFUNDED: "bg-secondary text-muted-foreground",
};

function csvCell(v: unknown) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function exportCsv(rows: OrderRow[], filename: string) {
  const headers = ["Order", "Buyer", "Company", "Date", "Items", "Total", "Currency", "Type", "Status"];
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push([r.orderNumber, r.buyer, r.company, r.date, r.itemCount, r.total, r.currency, r.type, r.status].map(csvCell).join(","));
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function OrdersTable({ rows, total }: { rows: OrderRow[]; total: number }) {
  const router = useRouter();
  const { toast } = useToast();
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [pending, setPending] = React.useState(false);

  const allSelected = rows.length > 0 && selected.size === rows.length;
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)));
  const toggle = (id: string) => setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const selectedRows = rows.filter((r) => selected.has(r.id));

  async function bulk(status: "PROCESSING" | "SHIPPED" | "DELIVERED") {
    setPending(true);
    const res = await bulkUpdateOrderStatus([...selected], status);
    setPending(false);
    setSelected(new Set());
    toast({ title: `${res.count} order${res.count !== 1 ? "s" : ""} updated`, description: `Marked ${status.toLowerCase()}.`, variant: "success" });
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border">
        <p className="text-xs text-muted-foreground">{selected.size > 0 ? `${selected.size} selected` : `${rows.length} of ${total} orders`}</p>
        <button
          type="button"
          onClick={() => exportCsv(selected.size > 0 ? selectedRows : rows, `orders-${new Date().toISOString().slice(0, 10)}.csv`)}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border text-xs font-medium hover:bg-secondary transition-colors"
        >
          <Download className="h-3.5 w-3.5" /> Export {selected.size > 0 ? "selected" : "CSV"}
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50 border-b border-border">
            <tr>
              <th className="ps-4 pe-2 py-3 w-8">
                <input type="checkbox" aria-label="Select all" checked={allSelected} onChange={toggleAll} className="rounded border-border accent-[hsl(var(--primary))]" />
              </th>
              {["Order #", "Buyer", "Date", "Items", "Total", "Type", "Status", ""].map((h) => (
                <th key={h} className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((o) => (
              <tr key={o.id} className={`transition-colors ${selected.has(o.id) ? "bg-primary/5" : "hover:bg-secondary/40"}`}>
                <td className="ps-4 pe-2 py-3"><input type="checkbox" aria-label={`Select ${o.orderNumber}`} checked={selected.has(o.id)} onChange={() => toggle(o.id)} className="rounded border-border accent-[hsl(var(--primary))]" /></td>
                <td className="px-4 py-3 font-mono text-xs font-semibold text-primary whitespace-nowrap">{o.orderNumber}</td>
                <td className="px-4 py-3"><p className="font-medium">{o.buyer}</p>{o.company && <p className="text-xs text-muted-foreground">{o.company}</p>}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{o.date}</td>
                <td className="px-4 py-3 text-center text-muted-foreground">{o.itemCount}</td>
                <td className="px-4 py-3 font-bold font-mono whitespace-nowrap">{formatCurrency(o.total, o.currency as "AED")}</td>
                <td className="px-4 py-3"><span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${o.type === "B2B" ? "bg-accent/15 text-accent" : "bg-primary/15 text-primary"}`}>{o.type}</span></td>
                <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${STATUS_CLS[o.status] ?? "bg-secondary text-muted-foreground"}`}>{o.status.replace(/_/g, " ")}</span></td>
                <td className="px-4 py-3"><Link href={`/orders/${o.id}`} className="text-xs text-primary hover:underline font-medium">View</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <div className="text-center py-16">
            <ShoppingCart className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
            <p className="font-semibold text-muted-foreground">No orders found</p>
          </div>
        )}
      </div>

      {/* Floating bulk action bar */}
      {selected.size > 0 && (
        <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-border bg-card/95 backdrop-blur">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <div className="flex items-center gap-2">
            <button type="button" disabled={pending} onClick={() => bulk("PROCESSING")} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-secondary text-foreground text-xs font-semibold hover:bg-secondary/70 transition-colors disabled:opacity-50"><Package className="h-3.5 w-3.5" /> Mark processing</button>
            <button type="button" disabled={pending} onClick={() => bulk("SHIPPED")} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"><Truck className="h-3.5 w-3.5" /> Mark shipped</button>
            <button type="button" disabled={pending} onClick={() => bulk("DELIVERED")} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-success/15 text-success text-xs font-semibold hover:bg-success/25 transition-colors disabled:opacity-50"><CheckCircle className="h-3.5 w-3.5" /> Delivered</button>
            {pending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            <button type="button" onClick={() => setSelected(new Set())} className="p-1.5 rounded-lg text-muted-foreground hover:bg-secondary" aria-label="Clear selection"><X className="h-4 w-4" /></button>
          </div>
        </div>
      )}
    </div>
  );
}
