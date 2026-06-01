"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Package, Download, Upload, AlertTriangle, X, Loader2, CheckCircle, EyeOff } from "lucide-react";
import { formatCurrency } from "@avenick/utils";
import { useToast } from "@/components/toast";
import { bulkUpdateProductStatus, importProductsCsv, type ImportRow } from "@/app/products/actions";

export type ProductRow = {
  id: string;
  nameEn: string;
  nameAr: string;
  sku: string;
  status: string;
  listingHealth: number;
  available: number;
  price: number | null;
  currency: string;
  issueCount: number;
  imageUrl: string | null;
};

const STATUS_CLS: Record<string, string> = {
  ACTIVE: "bg-success/15 text-success",
  DRAFT: "bg-secondary text-muted-foreground",
  PENDING_REVIEW: "bg-primary/15 text-primary",
  SUPPRESSED: "bg-danger/15 text-danger",
  REJECTED: "bg-danger/15 text-danger",
  INACTIVE: "bg-secondary text-muted-foreground",
};

const EXPORT_HEADERS = ["sku", "nameEn", "nameAr", "status", "price", "stock"] as const;

function csvCell(v: unknown) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function exportCsv(rows: ProductRow[], filename: string) {
  const lines = [EXPORT_HEADERS.join(",")];
  for (const r of rows) {
    lines.push([r.sku, r.nameEn, r.nameAr, r.status, r.price ?? "", r.available].map(csvCell).join(","));
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Minimal RFC-4180-ish CSV parser: handles quoted fields, escaped quotes, CRLF. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); field = ""; row = []; }
    else if (c === "\r") { /* skip */ }
    else field += c;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

function HealthBar({ score }: { score: number }) {
  const color = score >= 80 ? "bg-success" : score >= 60 ? "bg-yellow-500" : score >= 40 ? "bg-orange-500" : "bg-danger";
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5 w-16 h-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className={`flex-1 rounded-full ${i < Math.floor(score / 10) ? color : "bg-secondary"}`} />
        ))}
      </div>
      <span className="text-xs font-semibold">{score}</span>
    </div>
  );
}

export function ProductsTable({ rows }: { rows: ProductRow[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [pending, setPending] = React.useState(false);

  const allSelected = rows.length > 0 && selected.size === rows.length;
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)));
  const toggle = (id: string) =>
    setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const selectedRows = rows.filter((r) => selected.has(r.id));

  async function bulk(status: "ACTIVE" | "INACTIVE" | "SUPPRESSED") {
    setPending(true);
    const res = await bulkUpdateProductStatus([...selected], status);
    setPending(false);
    setSelected(new Set());
    toast({ title: `${res.count} product${res.count !== 1 ? "s" : ""} updated`, description: `Set to ${status.toLowerCase()}.`, variant: "success" });
    router.refresh();
  }

  async function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-importing the same file
    if (!file) return;

    setPending(true);
    try {
      const text = await file.text();
      const grid = parseCsv(text);
      if (grid.length < 2) {
        toast({ title: "Nothing to import", description: "CSV had no data rows.", variant: "error" });
        return;
      }
      const header = grid[0].map((h) => h.trim().toLowerCase());
      const idx = (name: string) => header.indexOf(name.toLowerCase());
      const skuI = idx("sku");
      if (skuI === -1) {
        toast({ title: "Missing 'sku' column", description: "Export the CSV first to get the right format.", variant: "error" });
        return;
      }
      const cols = { nameEn: idx("nameen"), nameAr: idx("namear"), status: idx("status"), price: idx("price"), stock: idx("stock") };
      const imports: ImportRow[] = grid.slice(1).map((r) => ({
        sku: r[skuI] ?? "",
        nameEn: cols.nameEn >= 0 ? r[cols.nameEn] : undefined,
        nameAr: cols.nameAr >= 0 ? r[cols.nameAr] : undefined,
        status: cols.status >= 0 ? r[cols.status] : undefined,
        price: cols.price >= 0 ? r[cols.price] : undefined,
        stock: cols.stock >= 0 ? r[cols.stock] : undefined,
      }));

      const res = await importProductsCsv(imports);
      const variant = res.updated > 0 ? "success" : "error";
      const desc = res.skipped > 0 ? `${res.skipped} skipped${res.errors[0] ? ` — ${res.errors[0]}` : ""}` : undefined;
      toast({ title: `${res.updated} product${res.updated !== 1 ? "s" : ""} updated`, ...(desc ? { description: desc } : {}), variant });
      router.refresh();
    } catch (err) {
      toast({ title: "Import failed", description: (err as Error).message, variant: "error" });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-border">
        <p className="text-xs text-muted-foreground">{selected.size > 0 ? `${selected.size} selected` : `${rows.length} product${rows.length !== 1 ? "s" : ""}`}</p>
        <div className="flex items-center gap-2">
          <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onImportFile} className="hidden" />
          <button
            type="button"
            disabled={pending}
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border text-xs font-medium hover:bg-secondary transition-colors disabled:opacity-50"
          >
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} Import CSV
          </button>
          <button
            type="button"
            onClick={() => exportCsv(selected.size > 0 ? selectedRows : rows, `products-${new Date().toISOString().slice(0, 10)}.csv`)}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border text-xs font-medium hover:bg-secondary transition-colors"
          >
            <Download className="h-3.5 w-3.5" /> Export {selected.size > 0 ? "selected" : "CSV"}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50 border-b border-border">
            <tr>
              <th className="ps-4 pe-2 py-3 w-8">
                <input type="checkbox" aria-label="Select all" checked={allSelected} onChange={toggleAll} className="rounded border-border accent-[hsl(var(--primary))]" />
              </th>
              {["Product", "SKU", "Status", "Health", "Stock", "Price", "Issues", ""].map((h) => (
                <th key={h} className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((p) => (
              <tr key={p.id} className={`transition-colors ${selected.has(p.id) ? "bg-primary/5" : "hover:bg-secondary/40"}`}>
                <td className="ps-4 pe-2 py-3"><input type="checkbox" aria-label={`Select ${p.nameEn}`} checked={selected.has(p.id)} onChange={() => toggle(p.id)} className="rounded border-border accent-[hsl(var(--primary))]" /></td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 shrink-0 rounded-lg overflow-hidden bg-secondary">
                      {p.imageUrl ? (
                        <Image src={p.imageUrl} alt={p.nameEn} width={40} height={40} className="object-cover w-full h-full" />
                      ) : <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">?</div>}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate max-w-[180px]">{p.nameEn}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-[180px]">{p.nameAr}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{p.sku}</td>
                <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${STATUS_CLS[p.status] ?? "bg-secondary text-muted-foreground"}`}>{p.status.replace(/_/g, " ")}</span></td>
                <td className="px-4 py-3"><HealthBar score={p.listingHealth} /></td>
                <td className="px-4 py-3">
                  <span className={p.available <= 0 ? "text-danger font-semibold" : p.available <= 10 ? "text-amber-600 dark:text-amber-400" : "text-foreground"}>{p.available}</span>
                </td>
                <td className="px-4 py-3 text-sm whitespace-nowrap">{p.price != null ? formatCurrency(p.price, p.currency as "AED") : "—"}</td>
                <td className="px-4 py-3">
                  {p.issueCount > 0 ? (
                    <Link href="/issues" className="flex items-center gap-1 text-danger hover:underline text-xs"><AlertTriangle className="h-3.5 w-3.5" />{p.issueCount}</Link>
                  ) : <span className="text-success text-xs">✓</span>}
                </td>
                <td className="px-4 py-3"><Link href={`/products/${p.id}/edit`} className="text-xs text-primary hover:underline font-medium">Edit</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <div className="text-center py-16">
            <Package className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
            <p className="font-semibold text-muted-foreground">No products yet.</p>
            <Link href="/products/new" className="text-primary hover:underline text-sm mt-2 inline-block">Add your first product →</Link>
          </div>
        )}
      </div>

      {/* Floating bulk action bar */}
      {selected.size > 0 && (
        <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-border bg-card/95 backdrop-blur">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <div className="flex items-center gap-2">
            <button type="button" disabled={pending} onClick={() => bulk("ACTIVE")} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-success/15 text-success text-xs font-semibold hover:bg-success/25 transition-colors disabled:opacity-50"><CheckCircle className="h-3.5 w-3.5" /> Activate</button>
            <button type="button" disabled={pending} onClick={() => bulk("INACTIVE")} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-secondary text-foreground text-xs font-semibold hover:bg-secondary/70 transition-colors disabled:opacity-50"><EyeOff className="h-3.5 w-3.5" /> Deactivate</button>
            <button type="button" disabled={pending} onClick={() => bulk("SUPPRESSED")} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-danger/15 text-danger text-xs font-semibold hover:bg-danger/25 transition-colors disabled:opacity-50"><X className="h-3.5 w-3.5" /> Suppress</button>
            {pending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            <button type="button" onClick={() => setSelected(new Set())} className="p-1.5 rounded-lg text-muted-foreground hover:bg-secondary" aria-label="Clear selection"><X className="h-4 w-4" /></button>
          </div>
        </div>
      )}
    </div>
  );
}
