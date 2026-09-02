import { ONBOARDING_SELLER_STATUSES, requireSellerAnyPermission } from "@/lib/auth";
import { SELLER_DOCUMENT_TYPE_LABELS, SUPERSEDED_REJECTION_REASON, db } from "@avenick/database";
import { browserDirectUploadsEnabled } from "@avenick/utils/browser-upload-policy";
import { SellerLayout } from "@/components/layout/seller-layout";
import { format, isAfter, addDays } from "date-fns";
import { AlertTriangle, CheckCircle, Clock, ExternalLink, RefreshCw, XCircle, Upload } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "Compliance" };

// Every row here belongs to the acting seller; never prerender or share it.
export const dynamic = "force-dynamic";

function DocStatus({ status }: { status: string }) {
  const map: Record<string, { icon: typeof CheckCircle; color: string; label: string }> = {
    APPROVED: { icon: CheckCircle, color: "text-green-600 dark:text-green-400", label: "Approved" },
    PENDING_REVIEW: { icon: Clock, color: "text-yellow-600 dark:text-yellow-400", label: "Pending Review" },
    REJECTED: { icon: XCircle, color: "text-red-600 dark:text-red-400", label: "Rejected" },
    EXPIRED: { icon: AlertTriangle, color: "text-red-600 dark:text-red-400", label: "Expired" },
    // A REJECTED row carrying the supersession reason was replaced by the
    // seller's own newer upload, not refused by an admin.
    SUPERSEDED: { icon: RefreshCw, color: "text-muted-foreground", label: "Replaced" },
  };
  const cfg = map[status] ?? map["PENDING_REVIEW"]!;
  return (
    <span className={`flex items-center gap-1 text-xs font-medium ${cfg.color}`}>
      <cfg.icon className="h-3.5 w-3.5" />{cfg.label}
    </span>
  );
}

export default async function CompliancePage() {
  // Same admission as the Document Center: a seller under review reads the
  // same rows here, so the two pages must agree on who may see them.
  const { seller, membership } = await requireSellerAnyPermission(["documents.view", "documents.manage"], {
    allowedSellerStatuses: ONBOARDING_SELLER_STATUSES,
  });
  const permissions = membership.permissions ?? [];
  const canUpload = (permissions.includes("*") || permissions.includes("documents.manage")) && browserDirectUploadsEnabled();

  const docs = await db.sellerDocument.findMany({
    where: { sellerId: seller.id },
    orderBy: [{ status: "asc" }, { uploadedAt: "desc" }],
  });

  // A refused or replaced row lapsing is not something the seller must act on;
  // only rows that are (or were) valid, or still awaiting a decision, count.
  const tracked = docs.filter((d) => d.status !== "REJECTED");
  const expiringSoon = tracked.filter((d) => d.expiryDate && isAfter(d.expiryDate, new Date()) && !isAfter(d.expiryDate, addDays(new Date(), 30)));
  const expired = tracked.filter((d) => d.expiryDate && !isAfter(d.expiryDate, new Date()));

  return (
    <SellerLayout sellerName={seller.businessNameEn} tier={seller.tier} issueCount={expired.length + expiringSoon.length} permissions={membership.permissions}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Compliance — الامتثال</h1>
          {/* Uploads live in the Document Center; this is a link to its uploader,
              shown only when the member can upload and storage is configured. */}
          {canUpload && (
            <Link
              href="/documents?upload=1"
              className="flex items-center gap-2 bg-orange-500 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-orange-600"
            >
              <Upload className="h-4 w-4" />
              Upload Document
            </Link>
          )}
        </div>

        {expired.length > 0 && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4">
            <h3 className="font-semibold text-red-700 dark:text-red-400 flex items-center gap-2"><AlertTriangle className="h-4 w-4" />Expired Documents ({expired.length})</h3>
            <p className="text-sm text-red-600 dark:text-red-400 mt-1">These documents have expired and may affect your account status.</p>
          </div>
        )}

        {expiringSoon.length > 0 && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4">
            <h3 className="font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-2"><Clock className="h-4 w-4" />Expiring Within 30 Days ({expiringSoon.length})</h3>
            <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">Please renew these documents soon to avoid service interruptions.</p>
          </div>
        )}

        <div className="bg-card rounded-2xl border border-border overflow-hidden">
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
                  const superseded = doc.status === "REJECTED" && doc.rejectionReason === SUPERSEDED_REJECTION_REASON;
                  const status = superseded ? "SUPERSEDED" : isExpired && doc.status === "APPROVED" ? "EXPIRED" : doc.status;
                  return (
                    <tr key={doc.id} className={`hover:bg-muted/20 ${isExpired ? "bg-red-500/10" : isExpiring ? "bg-amber-500/10" : ""}`}>
                      <td className="px-4 py-3 font-medium">{SELLER_DOCUMENT_TYPE_LABELS[doc.type]}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {/* The stored value is a private object key, not a URL; the
                            view route mints a short-lived signed link per request. */}
                        <a
                          href={`/documents/${doc.id}/view`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-orange-600 hover:underline"
                        >
                          {doc.fileName}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </td>
                      <td className="px-4 py-3"><DocStatus status={status} /></td>
                      <td className="px-4 py-3 text-sm">
                        {doc.expiryDate ? (
                          <span className={isExpired ? "text-red-600 dark:text-red-400 font-semibold" : isExpiring ? "text-amber-600 dark:text-amber-400 font-semibold" : ""}>
                            {format(doc.expiryDate, "MMM d, yyyy")}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{format(doc.uploadedAt, "MMM d, yyyy")}</td>
                      <td className="px-4 py-3">
                        {doc.rejectionReason && !superseded && (
                          <p className="text-xs text-red-600 dark:text-red-400">{doc.rejectionReason}</p>
                        )}
                        {canUpload && (isExpired || isExpiring || doc.status === "REJECTED") && !superseded && (
                          <Link
                            href={`/documents?upload=${doc.type}`}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-orange-600 hover:underline"
                          >
                            <RefreshCw className="h-3 w-3" />
                            {doc.status === "REJECTED" ? "Re-upload" : "Renew"}
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {docs.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                No compliance documents uploaded.
                {canUpload && (
                  <>
                    {" "}
                    <Link href="/documents?upload=1" className="text-orange-600 hover:underline font-medium">
                      Upload the first one
                    </Link>
                    .
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </SellerLayout>
  );
}
