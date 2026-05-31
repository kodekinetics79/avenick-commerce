import { requireSellerSession } from "@/lib/auth";
import { SellerLayout } from "@/components/layout/seller-layout";
import { MOCK_SELLER_DOCUMENTS } from "@avenick/database";
import { AlertTriangle, Upload, CheckCircle, Clock, XCircle, FileText, Calendar, RefreshCw, Eye } from "lucide-react";

export const metadata = { title: "Document Center" };

const STATUS_CONFIG = {
  APPROVED: { label: "Valid", color: "bg-green-100 text-green-700 border-green-200", dotColor: "bg-green-500", icon: CheckCircle },
  PENDING_REVIEW: { label: "Under Review", color: "bg-yellow-100 text-yellow-700 border-yellow-200", dotColor: "bg-yellow-500", icon: Clock },
  REJECTED: { label: "Rejected", color: "bg-red-100 text-red-700 border-red-200", dotColor: "bg-red-500", icon: XCircle },
  EXPIRED: { label: "Expired", color: "bg-red-100 text-red-700 border-red-200", dotColor: "bg-red-500", icon: XCircle },
};

function daysUntilExpiry(expiryDate: string): number {
  return Math.ceil((new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function isExpiringSoon(expiryDate: string): boolean {
  const days = daysUntilExpiry(expiryDate);
  return days <= 30 && days > 0;
}

function isExpired(expiryDate: string): boolean {
  return new Date(expiryDate) < new Date();
}

export default async function DocumentsPage() {
  const { seller } = await requireSellerSession();
  const documents = MOCK_SELLER_DOCUMENTS;

  const expiringDocs = documents.filter((d) => d.expiryDate && isExpiringSoon(d.expiryDate));
  const expiredDocs = documents.filter((d) => d.expiryDate && isExpired(d.expiryDate));
  const validDocs = documents.filter((d) => d.status === "APPROVED" && (!d.expiryDate || (!isExpired(d.expiryDate) && !isExpiringSoon(d.expiryDate))));

  return (
    <SellerLayout sellerName={seller.businessNameEn} tier={seller.tier}>
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
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
            <CheckCircle className="h-4 w-4 text-green-600 mb-2" />
            <p className="text-2xl font-bold text-green-700">{validDocs.length}</p>
            <p className="text-xs text-green-600 mt-0.5">Valid Documents</p>
          </div>
          <div className={`rounded-2xl border p-4 ${expiringDocs.length > 0 ? "bg-amber-50 border-amber-200" : "bg-white border-border"}`}>
            <AlertTriangle className={`h-4 w-4 mb-2 ${expiringDocs.length > 0 ? "text-amber-600" : "text-muted-foreground"}`} />
            <p className={`text-2xl font-bold ${expiringDocs.length > 0 ? "text-amber-700" : ""}`}>{expiringDocs.length}</p>
            <p className={`text-xs mt-0.5 ${expiringDocs.length > 0 ? "text-amber-600" : "text-muted-foreground"}`}>Expiring Soon</p>
          </div>
          <div className={`rounded-2xl border p-4 ${expiredDocs.length > 0 ? "bg-red-50 border-red-200" : "bg-white border-border"}`}>
            <XCircle className={`h-4 w-4 mb-2 ${expiredDocs.length > 0 ? "text-red-600" : "text-muted-foreground"}`} />
            <p className={`text-2xl font-bold ${expiredDocs.length > 0 ? "text-red-700" : ""}`}>{expiredDocs.length}</p>
            <p className={`text-xs mt-0.5 ${expiredDocs.length > 0 ? "text-red-600" : "text-muted-foreground"}`}>Expired</p>
          </div>
          <div className="bg-white border border-border rounded-2xl p-4">
            <Clock className="h-4 w-4 text-yellow-500 mb-2" />
            <p className="text-2xl font-bold">{documents.filter((d) => d.status === "PENDING_REVIEW").length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Under Review</p>
          </div>
        </div>

        {/* Alert banners */}
        {expiredDocs.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
            <div className="h-9 w-9 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
              <XCircle className="h-5 w-5 text-red-600" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-red-800 text-sm">{expiredDocs.length} document{expiredDocs.length > 1 ? "s" : ""} expired — Action required</p>
              <p className="text-xs text-red-600 mt-0.5">{expiredDocs.map((d) => d.name).join(", ")} — Please renew immediately to avoid account suspension.</p>
            </div>
            <button type="button" className="text-xs bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg font-semibold shrink-0 transition-colors">
              Renew Now
            </button>
          </div>
        )}
        {expiringDocs.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
            <div className="h-9 w-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-amber-800 text-sm">{expiringDocs.length} document{expiringDocs.length > 1 ? "s" : ""} expiring within 30 days</p>
              <p className="text-xs text-amber-600 mt-0.5">{expiringDocs.map((d) => d.name).join(", ")} — Upload renewed copies to avoid disruption to your account.</p>
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
                className={`bg-white rounded-2xl border p-4 hover:shadow-sm transition-shadow ${
                  expired ? "border-red-200 bg-red-50/30" :
                  expiring ? "border-amber-200 bg-amber-50/30" :
                  "border-border"
                }`}
              >
                {/* Icon + status */}
                <div className="flex items-start justify-between mb-3">
                  <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center">
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
                  <div className={`flex items-center gap-1.5 text-xs mb-3 ${expired ? "text-red-600" : expiring ? "text-amber-600" : "text-muted-foreground"}`}>
                    <Calendar className="h-3 w-3 shrink-0" />
                    <span>
                      {expired ? "Expired on " : "Expires "}
                      {doc.expiryDate}
                      {!expired && daysLeft !== null && (
                        <span className={`ml-1 font-semibold ${expiring ? "text-amber-600" : "text-green-600"}`}>
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
                    className="flex-1 flex items-center justify-center gap-1.5 text-xs border border-border text-muted-foreground px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors"
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
                      className="flex-1 flex items-center justify-center gap-1.5 text-xs border border-border text-muted-foreground px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors"
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
