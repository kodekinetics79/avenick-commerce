import { requireAdminSession } from "@/lib/auth";
import { db } from "@avenick/database";
import { AdminLayout } from "@/components/layout/admin-layout";
import Link from "next/link";
import { format } from "date-fns";

export default async function SellersPage({ searchParams }: { searchParams: { status?: string } }) {
  await requireAdminSession();
  const pendingCount = await db.sellerProfile.count({ where: { status: "PENDING_REVIEW" } });

  const sellers = await db.sellerProfile.findMany({
    where: { ...(searchParams.status && { status: searchParams.status as never }), deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      user: { select: { email: true, firstName: true, lastName: true } },
      documents: { select: { id: true, status: true } },
      _count: { select: { products: true } },
    },
  });

  const STATUS_COLORS: Record<string, string> = {
    ACTIVE: "bg-green-500/10 text-green-700 dark:text-green-400", PENDING_REVIEW: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
    SUSPENDED: "bg-red-500/10 text-red-700 dark:text-red-400", REJECTED: "bg-muted text-muted-foreground",
  };
  const TIER_COLORS: Record<string, string> = {
    PLATINUM: "bg-purple-500/10 text-purple-700 dark:text-purple-400", GOLD: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
    VERIFIED: "bg-primary/10 text-primary", STANDARD: "bg-muted text-muted-foreground",
  };

  return (
    <AdminLayout pendingCount={pendingCount}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Sellers ({sellers.length})</h1>
          <div className="flex gap-2">
            {[undefined, "PENDING_REVIEW", "ACTIVE", "SUSPENDED"].map((s) => (
              <Link key={s ?? "all"} href={s ? `/sellers?status=${s}` : "/sellers"}
                className={`text-xs px-3 py-1.5 rounded-lg border ${searchParams.status === s || (!searchParams.status && !s) ? "bg-primary text-white border-primary" : "border-border hover:bg-muted"}`}>
                {s ? s.replace(/_/g, " ") : "All"}
              </Link>
            ))}
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase">Seller</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase">CR</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase">Type</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase">Tier</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase">Status</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase">Products</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase">Docs</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase">Created</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sellers.map((s) => {
                  const pendingDocs = s.documents.filter((d) => d.status === "PENDING_REVIEW").length;
                  return (
                    <tr key={s.id} className="hover:bg-muted/20">
                      <td className="px-4 py-3">
                        <p className="font-medium">{s.businessNameEn}</p>
                        <p className="text-xs text-muted-foreground">{s.user.email}</p>
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{s.crNumber}</td>
                      <td className="px-4 py-3 text-xs">{s.type}</td>
                      <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TIER_COLORS[s.tier] ?? ""}`}>{s.tier}</span></td>
                      <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[s.status] ?? ""}`}>{s.status.replace(/_/g, " ")}</span></td>
                      <td className="px-4 py-3">{s._count.products}</td>
                      <td className="px-4 py-3">
                        {pendingDocs > 0 ? <span className="text-yellow-600 dark:text-yellow-400 font-semibold text-xs">{pendingDocs} pending</span> : <span className="text-green-600 dark:text-green-400 text-xs">✓</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{format(s.createdAt, "MMM d, yyyy")}</td>
                      <td className="px-4 py-3">
                        <Link href={`/sellers/${s.id}`} className="text-xs text-primary hover:underline">View</Link>
                      </td>
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
