"use client";

import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/layout/admin-layout";
import { CheckCircle, XCircle, ExternalLink } from "lucide-react";
import { format } from "date-fns";

interface SellerDoc { id: string; type: string; fileUrl: string; fileName: string; status: string }
interface PendingSeller {
  id: string; businessNameEn: string; businessNameAr?: string; crNumber: string;
  type: string; country: string; city: string; createdAt: string;
  user: { firstName: string; lastName: string; email: string };
  documents: SellerDoc[];
}

export default function PendingSellersPage() {
  const [sellers, setSellers] = useState<PendingSeller[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  useEffect(() => {
    fetch("/api/admin/sellers?status=PENDING_REVIEW")
      .then((r) => r.json())
      .then((d) => { setSellers(d.data ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function approve(id: string) {
    await fetch(`/api/admin/sellers/${id}/approve`, { method: "PUT" });
    setSellers((s) => s.filter((x) => x.id !== id));
  }

  async function reject(id: string) {
    if (!rejectReason.trim()) return;
    await fetch(`/api/admin/sellers/${id}/reject`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: rejectReason }) });
    setSellers((s) => s.filter((x) => x.id !== id));
    setRejecting(null);
    setRejectReason("");
  }

  return (
    <AdminLayout pendingCount={sellers.length}>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Pending Seller Reviews ({sellers.length})</h1>

        {loading ? (
          <div className="animate-pulse space-y-4">{[...Array(3)].map((_, i) => <div key={i} className="h-32 bg-muted rounded-2xl" />)}</div>
        ) : sellers.length === 0 ? (
          <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-8 text-center">
            <CheckCircle className="h-10 w-10 mx-auto text-green-500 dark:text-green-400 mb-2" />
            <p className="text-green-700 dark:text-green-400 font-semibold">All caught up! No pending reviews.</p>
          </div>
        ) : (
          sellers.map((seller) => (
            <div key={seller.id} className="bg-card rounded-2xl border border-border p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold">{seller.businessNameEn}</h2>
                  {seller.businessNameAr && <p className="text-sm text-muted-foreground" dir="rtl">{seller.businessNameAr}</p>}
                  <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                    <span>CR: {seller.crNumber}</span>
                    <span>·</span>
                    <span>{seller.type}</span>
                    <span>·</span>
                    <span>{seller.country} — {seller.city}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Owner: {seller.user.firstName} {seller.user.lastName} ({seller.user.email})
                  </p>
                  <p className="text-xs text-muted-foreground">Applied: {format(new Date(seller.createdAt), "MMM d, yyyy")}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => approve(seller.id)}
                    className="flex items-center gap-2 bg-green-500 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-green-600"
                  >
                    <CheckCircle className="h-4 w-4" />Approve
                  </button>
                  <button
                    onClick={() => setRejecting(seller.id)}
                    className="flex items-center gap-2 bg-red-500 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-red-600"
                  >
                    <XCircle className="h-4 w-4" />Reject
                  </button>
                </div>
              </div>

              {/* Documents */}
              {seller.documents.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">SUBMITTED DOCUMENTS</p>
                  <div className="flex flex-wrap gap-2">
                    {seller.documents.map((doc) => (
                      <a key={doc.id} href={doc.fileUrl} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-muted rounded-lg hover:bg-muted/70 transition-colors">
                        <ExternalLink className="h-3 w-3" />
                        {doc.type.replace(/_/g, " ")}
                        <span className={`ms-1 text-xs ${doc.status === "APPROVED" ? "text-green-600" : doc.status === "REJECTED" ? "text-red-600" : "text-yellow-600"}`}>
                          ({doc.status.replace(/_/g, " ")})
                        </span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Reject form */}
              {rejecting === seller.id && (
                <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                  <label className="text-sm font-medium text-red-700 dark:text-red-400 block mb-2">Rejection reason (required):</label>
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    rows={2}
                    className="w-full rounded-lg border border-red-500/30 p-2 text-sm focus:ring-2 focus:ring-red-400"
                    placeholder="Explain why this seller application is being rejected..."
                  />
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => reject(seller.id)} disabled={!rejectReason.trim()} className="bg-red-500 text-white px-3 py-1.5 rounded-lg text-sm font-semibold disabled:opacity-50">Confirm Reject</button>
                    <button onClick={() => { setRejecting(null); setRejectReason(""); }} className="px-3 py-1.5 rounded-lg text-sm border border-border">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </AdminLayout>
  );
}
