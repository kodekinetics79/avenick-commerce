import { requireAdminSession } from "@/lib/auth";
import { db } from "@avenick/database";
import { AdminLayout } from "@/components/layout/admin-layout";
import { format, addDays, isAfter } from "date-fns";
import Link from "next/link";

export default async function AdminCompliancePage() {
  await requireAdminSession();
  const pendingCount = await db.sellerProfile.count({ where: { status: "PENDING_REVIEW" } });

  const docs = await db.sellerDocument.findMany({
    where: { status: { in: ["PENDING_REVIEW", "APPROVED", "REJECTED", "EXPIRED"] } },
    orderBy: [{ status: "asc" }, { uploadedAt: "desc" }],
    take: 100,
    include: { seller: { select: { id: true, businessNameEn: true } } },
  });

  return (
    <AdminLayout pendingCount={pendingCount}>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Compliance Documents ({docs.length})</h1>

        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase">Seller</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase">Document</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase">Status</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase">Expiry</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase">Uploaded</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {docs.map((doc) => {
                  const isExpiring = doc.expiryDate && isAfter(doc.expiryDate, new Date()) && !isAfter(doc.expiryDate, addDays(new Date(), 30));
                  return (
                    <tr key={doc.id} className={`hover:bg-muted/20 ${doc.status === "PENDING_REVIEW" ? "bg-yellow-500/5" : ""}`}>
                      <td className="px-4 py-3">
                        <Link href={`/sellers/${doc.seller.id}`} className="text-primary hover:underline text-sm">{doc.seller.businessNameEn}</Link>
                      </td>
                      <td className="px-4 py-3">
                        <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="text-sm hover:underline">{doc.type.replace(/_/g, " ")}</a>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${doc.status === "APPROVED" ? "bg-green-500/10 text-green-700 dark:text-green-400" : doc.status === "REJECTED" ? "bg-red-500/10 text-red-700 dark:text-red-400" : "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400"}`}>
                          {doc.status.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {doc.expiryDate ? (
                          <span className={isExpiring ? "text-amber-600 dark:text-amber-400 font-semibold" : ""}>{format(doc.expiryDate, "MMM d, yyyy")}</span>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{format(doc.uploadedAt, "MMM d, yyyy")}</td>
                      <td className="px-4 py-3">
                        {doc.status === "PENDING_REVIEW" && (
                          <Link href={`/sellers/${doc.seller.id}`} className="text-xs text-primary hover:underline">Review</Link>
                        )}
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
