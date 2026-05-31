import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { db } from "@avenick/database";
import Link from "next/link";
import { CheckSquare, Package, Store, FileCheck, CheckCircle, XCircle, ArrowRight } from "lucide-react";

export const metadata = { title: "Approvals" };

export default async function ApprovalsPage() {
  await requireAdminSession();

  const [pendingProducts, pendingSellers, pendingDocs] = await Promise.all([
    db.product.count({ where: { status: "PENDING_REVIEW", deletedAt: null } }).catch(() => 0),
    db.sellerProfile.count({ where: { status: "PENDING_REVIEW" } }).catch(() => 0),
    db.sellerDocument.count({ where: { status: "PENDING_REVIEW" } }).catch(() => 0),
  ]);

  const products = await db.product.findMany({
    where: { status: "PENDING_REVIEW", deletedAt: null },
    take: 8,
    orderBy: { createdAt: "desc" },
    include: { seller: { select: { businessNameEn: true } }, category: { select: { nameEn: true } } },
  }).catch(() => []);

  const queues = [
    { label: "Product Listings", count: pendingProducts, icon: Package, href: "/products", color: "bg-blue-100 text-primary" },
    { label: "Supplier Applications", count: pendingSellers, icon: Store, href: "/sellers/pending", color: "bg-purple-100 text-purple-600" },
    { label: "Compliance Documents", count: pendingDocs, icon: FileCheck, href: "/compliance", color: "bg-amber-100 text-amber-600" },
  ];
  const totalPending = pendingProducts + pendingSellers + pendingDocs;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Approvals</h1>
          <p className="text-sm text-muted-foreground">{totalPending} items awaiting marketplace review</p>
        </div>

        {/* Queue summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {queues.map((q) => (
            <Link key={q.label} href={q.href} className="bg-card rounded-2xl border border-border shadow-card p-4 hover:shadow-elevated transition-shadow">
              <div className="flex items-center justify-between mb-2">
                <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${q.color}`}><q.icon className="h-4 w-4" /></div>
                {q.count > 0 && <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />}
              </div>
              <p className="text-2xl font-bold">{q.count}</p>
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">{q.label} <ArrowRight className="h-3 w-3" /></p>
            </Link>
          ))}
        </div>

        {/* Product approval queue */}
        <div className="bg-card rounded-2xl border border-border shadow-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <CheckSquare className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold">Product Listings Awaiting Review</h2>
          </div>
          {products.length === 0 ? (
            <div className="px-5 py-14 text-center">
              <CheckCircle className="h-10 w-10 mx-auto text-green-300 mb-3" />
              <p className="font-semibold text-muted-foreground">All caught up</p>
              <p className="text-sm text-muted-foreground mt-1">No product listings pending review.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {products.map((p) => (
                <div key={p.id} className="flex items-center justify-between px-5 py-3.5">
                  <div className="min-w-0">
                    <p className="font-medium text-sm">{p.nameEn}</p>
                    <p className="text-xs text-muted-foreground">{p.seller?.businessNameEn} · {p.category?.nameEn} · {p.sku}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button type="button" className="flex items-center gap-1 text-xs bg-green-500 text-white px-3 py-1.5 rounded-lg hover:bg-green-600 font-medium transition-colors"><CheckCircle className="h-3 w-3" /> Approve</button>
                    <button type="button" className="flex items-center gap-1 text-xs border border-border text-muted-foreground px-3 py-1.5 rounded-lg hover:bg-red-50 hover:text-red-600 hover:border-red-200 font-medium transition-colors"><XCircle className="h-3 w-3" /> Reject</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
