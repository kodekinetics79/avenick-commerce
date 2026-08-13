import { requireSellerAnyPermission } from "@/lib/auth";
import { SellerLayout } from "@/components/layout/seller-layout";
import { db } from "@avenick/database";
import { AlertTriangle, Upload, CheckCircle, Clock, XCircle, FileText, Calendar, RefreshCw, Eye } from "lucide-react";

export const metadata = { title: "Document Center" };

const STATUS_CONFIG = {
  APPROVED: { label: "Valid", color: "bg-success/15 text-success border-success/30", dotColor: "bg-success", icon: CheckCircle },
  PENDING_REVIEW: { label: "Under Review", color: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30", dotColor: "bg-amber-500", icon: Clock },
  REJECTED: { label: "Rejected", color: "bg-danger/15 text-danger border-danger/30", dotColor: "bg-danger", icon: XCircle },
  EXPIRED: { label: "Expired", color: "bg-danger/15 text-danger border-danger/30", dotColor: "bg-danger", icon: XCircle },
};

function daysUntilExpiry(d: Date): number {
  return Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}
function isExpiringSoon(d: Date): boolean {
  const days = daysUntilExpiry(d);
  return days <= 30 && days > 0;
}
function isExpired(d: Date): boolean {
  return d < new Date();
}
const fmtDate = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export default async function DocumentsPage() {
  const { seller, membership } = await requireSellerAnyPermission(["documents.view", "documents.manage"]);
  const raw = await db.sellerDocument.findMany({ where: { sellerId: seller.id }, orderBy: { uploadedAt: "desc" } });
  const documents = raw.map((d) => ({
    id: d.id,
    name: d.fileName || d.type.replace(/_/g, " "),
    type: d.type as string,
    status: d.status as string,
    expiryDate: d.expiryDate as Date | null,
  }));

  const expiringDocs = documents.filter((d) => d.expiryDate && isExpiringSoon(d.expiryDate));
  const expiredDocs = documents.filter((d) => d.expiryDate && isExpired(d.expiryDate));
  const validDocs = documents.filter((d) => d.status === "APPROVED" && (!d.expiryDate || (!isExpired(d.expiryDate) && !isExpiringSoon(d.expiryDate))));

  return (
    <SellerLayout sellerName={seller.businessNameEn} tier={seller.tier} permissions={membership.permissions}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Document Center</h1>
            <p className="text-muted-foreground text-sm">Manage your compliance and business documents</p>
          </div>
          <button
            type="button"
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors shadow-sm"
          >
            <Upload className="h-4 w-4" /> Upload Document
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-4">
            <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 mb-2" />
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{validDocs.length}</p>
            <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">Valid Documents</p>
          </div>
          <div className={`rounded-2xl border p-4 ${expiringDocs.length > 0 ? "bg-amber-500/10 border-amber-500/20" : "bg-card border-border"}`}>
            <AlertTriangle className={`h-4 w-4 mb-2 ${expiringDocs.length > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`} />
            <p className={`text-2xl font-bold ${expiringDocs.length > 0 ? "text-amber-700 dark:text-amber-400" : ""}`}>{expiringDocs.length}</p>
            <p className={`text-xs mt-0.5 ${expiringDocs.length > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>Expiring Soon</p>
          </div>
          <div className={`rounded-2xl border p-4 ${expiredDocs.length > 0 ? "bg-red-500/10 border-red-500/20" : "bg-card border-border"}`}>
            <XCircle className={`h-4 w-4 mb-2 ${expiredDocs.length > 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`} />
            <p className={`text-2xl font-bold ${expiredDocs.length > 0 ? "text-red-700 dark:text-red-400" : ""}`}>{expiredDocs.length}</p>
            <p className={`text-xs mt-0.5 ${expiredDocs.length > 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>Expired</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4">
            <Clock className="h-4 w-4 text-yellow-500 mb-2" />
            <p className="text-2xl font-bold">{documents.filter((d) => d.status === "PENDING_REVIEW").length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Under Review</p>
          </div>
        </div>

        {/* Alert banners */}
        {expiredDocs.length > 0 && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-start gap-3">
            <div className="h-9 w-9 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
              <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-red-700 dark:text-red-400 text-sm">{expiredDocs.length} document{expiredDocs.length > 1 ? "s" : ""} expired — Action required</p>
              <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">{expiredDocs.map((d) => d.name).join(", ")} — Please renew immediately to avoid account suspension.</p>
            </div>
            <button type="button" className="text-xs bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg font-semibold shrink-0 transition-colors">
              Renew Now
            </button>
          </div>
        )}
        {expiringDocs.length > 0 && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-start gap-3">
            <div className="h-9 w-9 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-amber-700 dark:text-amber-400 text-sm">{expiringDocs.length} document{expiringDocs.length > 1 ? "s" : ""} expiring within 30 days</p>
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">{expiringDocs.map((d) => d.name).join(", ")} — Upload renewed copies to avoid disruption to your account.</p>
            </div>
            <button type="button" className="text-xs bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg font-semibold shrink-0 transition-colors">
              Upload Renewal
            </button>
          </div>
        )}

        {/* Documents grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {documents.map((doc) => {
            const cfg = STATUS_CONFIG[doc.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.PENDING_REVIEW;
            const StatusIcon = cfg.icon;
            const expiring = doc.expiryDate && isExpiringSoon(doc.expiryDate);
            const expired = doc.expiryDate && isExpired(doc.expiryDate);
            const daysLeft = doc.expiryDate && !expired ? daysUntilExpiry(doc.expiryDate) : null;

            return (
              <div
                key={doc.id}
                className={`bg-card rounded-2xl border p-4 hover:shadow-sm transition-shadow ${
                  expired ? "border-red-500/20 bg-red-500/5" :
                  expiring ? "border-amber-500/20 bg-amber-500/5" :
                  "border-border"
                }`}
              >
                {/* Icon + status */}
                <div className="flex items-start justify-between mb-3">
                  <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${cfg.color}`}>
                    <StatusIcon className="h-3 w-3" />
                    {cfg.label}
                  </span>
                </div>

                {/* Name + type */}
                <h3 className="font-semibold text-sm text-foreground mb-0.5">{doc.name}</h3>
                <p className="text-xs text-muted-foreground mb-3">{doc.type.replace(/_/g, " ")}</p>

                {/* Expiry info */}
                {doc.expiryDate && (
                  <div className={`flex items-center gap-1.5 text-xs mb-3 ${expired ? "text-red-600 dark:text-red-400" : expiring ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
                    <Calendar className="h-3 w-3 shrink-0" />
                    <span>
                      {expired ? "Expired on " : "Expires "}
                      {fmtDate(doc.expiryDate)}
                      {!expired && daysLeft !== null && (
                        <span className={`ml-1 font-semibold ${expiring ? "text-amber-600 dark:text-amber-400" : "text-green-600 dark:text-green-400"}`}>
                          ({daysLeft > 0 ? `${daysLeft} days left` : "today"})
                        </span>
                      )}
                    </span>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="flex-1 flex items-center justify-center gap-1.5 text-xs border border-border text-muted-foreground px-3 py-1.5 rounded-lg hover:bg-muted transition-colors"
                  >
                    <Eye className="h-3 w-3" /> View
                  </button>
                  {(expiring || expired || doc.status === "REJECTED") ? (
                    <button
                      type="button"
                      className="flex-1 flex items-center justify-center gap-1.5 text-xs bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded-lg font-semibold transition-colors"
                    >
                      <RefreshCw className="h-3 w-3" />
                      {expired ? "Renew" : "Update"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="flex-1 flex items-center justify-center gap-1.5 text-xs border border-border text-muted-foreground px-3 py-1.5 rounded-lg hover:bg-muted transition-colors"
                    >
                      <Upload className="h-3 w-3" /> Replace
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </SellerLayout>
  );
}
