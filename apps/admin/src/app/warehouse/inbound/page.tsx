import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { getInboundMovements } from "@avenick/database";
import { ArrowLeft, Truck, PackagePlus, SlidersHorizontal } from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";

export const metadata = { title: "Inbound Receiving" };
export const dynamic = "force-dynamic";

const TYPE_CONFIG: Record<string, { label: string; color: string; icon: typeof PackagePlus }> = {
  IN: { label: "Stock In", color: "bg-green-100 text-green-700", icon: PackagePlus },
  ADJUSTMENT: { label: "Adjustment", color: "bg-amber-100 text-amber-700", icon: SlidersHorizontal },
};

interface PageProps {
  searchParams: { page?: string };
}

export default async function InboundPage({ searchParams }: PageProps) {
  await requireAdminSession();

  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  const limit = 30;
  const { movements, total } = await getInboundMovements({ page, limit });
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const inCount = movements.filter((m) => m.type === "IN").length;
  const adjCount = movements.filter((m) => m.type === "ADJUSTMENT").length;
  const unitsIn = movements.filter((m) => m.type === "IN").reduce((s, m) => s + m.qty, 0);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link href="/warehouse" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
                <ArrowLeft className="h-3.5 w-3.5" /> Warehouse
              </Link>
              <span className="text-muted-foreground">/</span>
              <span className="text-sm font-medium">Inbound</span>
            </div>
            <h1 className="text-2xl font-bold">Inbound Receiving</h1>
            <p className="text-sm text-muted-foreground">Stock-in movements and inventory adjustments from the movement ledger.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total movements", value: total },
            { label: "Stock-in (this page)", value: inCount },
            { label: "Adjustments (this page)", value: adjCount },
            { label: "Units received (this page)", value: unitsIn.toLocaleString() },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-border bg-white p-4">
              <span className="text-sm text-muted-foreground">{s.label}</span>
              <p className="text-2xl font-bold mt-1">{s.value}</p>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-border">
                <tr>
                  {["Date", "Type", "Product", "Qty", "Location", "Reference", "Notes"].map((h) => (
                    <th key={h} className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {movements.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center">
                      <Truck className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                      <p className="text-sm text-muted-foreground">
                        No inbound movements recorded yet. Stock-ins appear here when sellers or warehouse staff receive inventory.
                      </p>
                    </td>
                  </tr>
                )}
                {movements.map((m) => {
                  const cfg = TYPE_CONFIG[m.type] ?? TYPE_CONFIG["IN"]!;
                  const Icon = cfg.icon;
                  return (
                    <tr key={m.id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{format(m.createdAt, "MMM d, yyyy HH:mm")}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${cfg.color}`}>
                          <Icon className="h-3 w-3" /> {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium">{m.stock.product?.nameEn ?? "—"}</p>
                        <p className="text-xs text-muted-foreground font-mono">{m.stock.product?.sku ?? ""}</p>
                      </td>
                      <td className={`px-4 py-3 font-semibold ${m.qty >= 0 ? "text-green-700" : "text-red-600"}`}>
                        {m.qty >= 0 ? `+${m.qty}` : m.qty}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {m.stock.location.warehouse.nameEn} · <span className="font-mono text-xs">{m.stock.location.code}</span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{m.reference ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground max-w-[14rem] truncate">{m.notes ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border text-sm">
              <span className="text-muted-foreground">Page {page} of {totalPages} · {total} movements</span>
              <div className="flex gap-2">
                {page > 1 && (
                  <Link href={`/warehouse/inbound?page=${page - 1}`} className="px-3 py-1.5 rounded-lg border border-border hover:bg-muted text-xs">Previous</Link>
                )}
                {page < totalPages && (
                  <Link href={`/warehouse/inbound?page=${page + 1}`} className="px-3 py-1.5 rounded-lg border border-border hover:bg-muted text-xs">Next</Link>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
