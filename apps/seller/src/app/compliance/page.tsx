import { requireSellerSession } from "@/lib/auth";
import { db } from "@avenick/database";
import { SellerLayout } from "@/components/layout/seller-layout";
import { format, isAfter, addDays } from "date-fns";
import { AlertTriangle, CheckCircle, Clock, XCircle, Upload } from "lucide-react";
import Link from "next/link";

function DocStatus({ status }: { status: string }) {
  const map: Record<string, { icon: typeof CheckCircle; color: string; label: string }> = {
    APPROVED: { icon: CheckCircle, color: "text-green-600", label: "Approved" },
    PENDING_REVIEW: { icon: Clock, color: "text-yellow-600", label: "Pending Review" },
    REJECTED: { icon: XCircle, color: "text-red-600", label: "Rejected" },
    EXPIRED: { icon: AlertTriangle, color: "text-red-600", label: "Expired" },
  };
  const cfg = map[status] ?? map["PENDING_REVIEW"]!;
  return (
    <span className={`flex items-center gap-1 text-xs font-medium ${cfg.color}`}>
      <cfg.icon className="h-3.5 w-3.5" />{cfg.label}
    </span>
  );
}

export default async function CompliancePage() {
  const { seller } = await requireSellerSession();

  const docs = await db.sellerDocument.findMany({
    where: { sellerId: seller.id },
    orderBy: [{ status: "asc" }, { uploadedAt: "desc" }],
  });

  const expiringSoon = docs.filter((d) => d.expiryDate && isAfter(d.expiryDate, new Date()) && !isAfter(d.expiryDate, addDays(new Date(), 30)));
  const expired = docs.filter((d) => d.expiryDate && !isAfter(d.expiryDate, new Date()));

  return (
    <SellerLayout sellerName={seller.businessNameEn} tier={seller.tier} issueCount={expired.length + expiringSoon.length}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Compliance — الامتثال</h1>
          <button className="flex items-center gap-2 bg-orange-500 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-orange-600">
            <Upload className="h-4 w-4" />
            Upload Document
          </button>
        </div>

        {expired.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
            <h3 className="font-semibold text-red-800 flex items-center gap-2"><AlertTriangle className="h-4 w-4" />Expired Documents ({expired.length})</h3>
            <p className="text-sm text-red-600 mt-1">These documents have expired and may affect your account status.</p>
          </div>
        )}

        {expiringSoon.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <h3 className="font-semibold text-amber-800 flex items-center gap-2"><Clock className="h-4 w-4" />Expiring Within 30 Days ({expiringSoon.length})</h3>
            <p className="text-sm text-amber-600 mt-1">Please renew these documents soon to avoid service interruptions.</p>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase">Document Type</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase">File</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase">Status</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase">Expiry</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase">Uploaded</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {docs.map((doc) => {
                  const isExpired = doc.expiryDate && !isAfter(doc.expiryDate, new Date());
                  const isExpiring = doc.expiryDate && isAfter(doc.expiryDate, new Date()) && !isAfter(doc.expiryDate, addDays(new Date(), 30));
                  return (
                    <tr key={doc.id} className={`hover:bg-muted/20 ${isExpired ? "bg-red-50/50" : isExpiring ? "bg-amber-50/50" : ""}`}>
                      <td className="px-4 py-3 font-medium">{doc.type.replace(/_/g, " ")}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="text-orange-600 hover:underline">{doc.fileName}</a>
                      </td>
                      <td className="px-4 py-3"><DocStatus status={isExpired ? "EXPIRED" : doc.status} /></td>
                      <td className="px-4 py-3 text-sm">
                        {doc.expiryDate ? (
                          <span className={isExpired ? "text-red-600 font-semibold" : isExpiring ? "text-amber-600 font-semibold" : ""}>
                            {format(doc.expiryDate, "MMM d, yyyy")}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{format(doc.uploadedAt, "MMM d, yyyy")}</td>
                      <td className="px-4 py-3">
                        {doc.rejectionReason && <p className="text-xs text-red-600">{doc.rejectionReason}</p>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {docs.length === 0 && <div className="text-center py-12 text-muted-foreground">No compliance documents uploaded.</div>}
          </div>
        </div>
      </div>
    </SellerLayout>
  );
}
