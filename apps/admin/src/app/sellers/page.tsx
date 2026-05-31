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
    ACTIVE: "bg-green-100 text-green-700", PENDING_REVIEW: "bg-yellow-100 text-yellow-700",
    SUSPENDED: "bg-red-100 text-red-700", REJECTED: "bg-gray-100 text-gray-600",
  };
  const TIER_COLORS: Record<string, string> = {
    PLATINUM: "bg-purple-100 text-purple-700", GOLD: "bg-yellow-100 text-yellow-700",
    VERIFIED: "bg-blue-100 text-blue-700", STANDARD: "bg-gray-100 text-gray-600",
  };

  return (
    <AdminLayout pendingCount={pendingCount}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Sellers ({sellers.length})</h1>
          <div className="flex gap-2">
            {[undefined, "PENDING_REVIEW", "ACTIVE", "SUSPENDED"].map((s) => (
              <Link key={s ?? "all"} href={s ? `/sellers?status=${s}` : "/sellers"}
                className={`text-xs px-3 py-1.5 rounded-lg border ${searchParams.status === s || (!searchParams.status && !s) ? "bg-blue-600 text-white border-blue-600" : "border-border hover:bg-muted"}`}>
                {s ? s.replace(/_/g, " ") : "All"}
              </Link>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-border">
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
                        {pendingDocs > 0 ? <span className="text-yellow-600 font-semibold text-xs">{pendingDocs} pending</span> : <span className="text-green-600 text-xs">✓</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{format(s.createdAt, "MMM d, yyyy")}</td>
                      <td className="px-4 py-3">
                        <Link href={`/sellers/${s.id}`} className="text-xs text-blue-600 hover:underline">View</Link>
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
