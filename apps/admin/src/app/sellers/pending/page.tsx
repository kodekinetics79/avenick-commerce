"use client";

import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/layout/admin-layout";
import { CheckCircle, XCircle, ExternalLink } from "lucide-react";
import { format } from "date-fns";

interface SellerDoc { id: string; type: string; fileName: string; status: string }
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
  // A decision that did not land must not vanish from the queue as if it had.
  const [notice, setNotice] = useState<{ sellerId: string; message: string; currentStatus?: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/sellers?status=PENDING_REVIEW")
      .then((r) => r.json())
      .then((d) => { setSellers(d.data ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  /**
   * Record a decision and only then drop the card. The API refuses an
   * application another admin already decided (409, carrying the real status)
   * and a row that is gone (404); removing the card on either would tell the
   * reviewer their click was honoured when nothing was written.
   */
  async function decide(id: string, path: "approve" | "reject", init: RequestInit): Promise<boolean> {
    setBusy(id);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/sellers/${id}/${path}`, { method: "PUT", ...init });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.success) {
        setNotice({
          sellerId: id,
          message: typeof body?.error === "string" ? body.error : "The decision was not recorded.",
          currentStatus: typeof body?.currentStatus === "string" ? body.currentStatus : undefined,
        });
        return false;
      }
      setSellers((list) => list.filter((x) => x.id !== id));
      return true;
    } catch {
      setNotice({ sellerId: id, message: "The decision was not recorded." });
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function approve(id: string) {
    await decide(id, "approve", {});
  }

  async function reject(id: string) {
    if (!rejectReason.trim()) return;
    const recorded = await decide(id, "reject", {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: rejectReason }),
    });
    if (recorded) {
      setRejecting(null);
      setRejectReason("");
    }
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
                    disabled={busy === seller.id}
                    className="flex items-center gap-2 bg-green-500 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-green-600 disabled:opacity-50"
                  >
                    <CheckCircle className="h-4 w-4" />Approve
                  </button>
                  <button
                    onClick={() => setRejecting(seller.id)}
                    disabled={busy === seller.id}
                    className="flex items-center gap-2 bg-red-500 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-red-600 disabled:opacity-50"
                  >
                    <XCircle className="h-4 w-4" />Reject
                  </button>
                </div>
              </div>

              {notice?.sellerId === seller.id && (
                <p role="alert" className="mb-3 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5">
                  {notice.message}
                  {notice.currentStatus && <> Current status: <strong>{notice.currentStatus.replace(/_/g, " ")}</strong>.</>}
                </p>
              )}

              {/* Documents */}
              {seller.documents.length === 0 ? (
                // Silence here would read as "nothing to check"; the reviewer
                // must see that approval would rest on no filed evidence.
                <p className="text-xs text-muted-foreground">No documents have been submitted for this application.</p>
              ) : (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">SUBMITTED DOCUMENTS</p>
                  <div className="flex flex-wrap gap-2">
                    {seller.documents.map((doc) => (
                      // The stored file reference is a private object key, not a
                      // link; the view route mints a short-lived signed URL per request.
                      <a key={doc.id} href={`/documents/${encodeURIComponent(doc.id)}/view`} target="_blank" rel="noopener noreferrer"
                        title={doc.fileName}
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
                    <button onClick={() => reject(seller.id)} disabled={!rejectReason.trim() || busy === seller.id} className="bg-red-500 text-white px-3 py-1.5 rounded-lg text-sm font-semibold disabled:opacity-50">Confirm Reject</button>
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
