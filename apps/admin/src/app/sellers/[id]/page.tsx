"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { AdminLayout } from "@/components/layout/admin-layout";
import { CheckCircle, XCircle, ExternalLink, AlertTriangle } from "lucide-react";
import { formatCurrency, isRecordId } from "@avenick/utils";
import Link from "next/link";

/**
 * What a document decision came back with when it did not land. A 409 carries
 * the row's real status so the reviewer sees what the queue missed; a 404 or a
 * network failure carries only the message.
 */
type DocumentNotice = { docId: string; message: string; currentStatus?: string };

export default function SellerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [seller, setSeller] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [rejectDocId, setRejectDocId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectSellerOpen, setRejectSellerOpen] = useState(false);
  const [sellerRejectReason, setSellerRejectReason] = useState("");
  const [sellerRejectError, setSellerRejectError] = useState<string | null>(null);
  const [sellerDecisionError, setSellerDecisionError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [docNotice, setDocNotice] = useState<DocumentNotice | null>(null);
  const [docBusy, setDocBusy] = useState<string | null>(null);

  useEffect(() => {
    // A malformed id is never a seller; skip the request and fall through to
    // the not-found state rather than asking the API to say so.
    if (!isRecordId(id)) { setLoading(false); return; }
    fetch(`/api/admin/sellers/${id}`)
      .then((r) => r.json())
      .then((d) => { setSeller(d.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id]);

  // A document decision is only reloaded into view when the API says it was
  // recorded. A 409 means the page was stale (already decided or replaced by a
  // newer upload) and a 404 means the row is gone; both are shown beside the
  // row instead of reloading into a state that quietly disagrees with the click.
  async function decideDoc(docId: string, path: "approve" | "reject", init: RequestInit): Promise<boolean> {
    setDocBusy(docId);
    setDocNotice(null);
    try {
      const res = await fetch(`/api/admin/compliance/${docId}/${path}`, { method: "PUT", ...init });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.success) {
        setDocNotice({
          docId,
          message: typeof body?.error === "string" ? body.error : "The decision was not recorded.",
          currentStatus: typeof body?.currentStatus === "string" ? body.currentStatus : undefined,
        });
        return false;
      }
      return true;
    } catch {
      setDocNotice({ docId, message: "The decision was not recorded." });
      return false;
    } finally {
      setDocBusy(null);
    }
  }

  async function approveDoc(docId: string) {
    if (await decideDoc(docId, "approve", {})) window.location.reload();
  }

  async function rejectDoc(docId: string) {
    const recorded = await decideDoc(docId, "reject", {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: rejectReason }),
    });
    if (recorded) window.location.reload();
  }

  // Approval is a recorded decision like the rejection below: the API refuses a
  // seller who is no longer pending, and reloading on any response would show a
  // page that quietly disagrees with the click. Read the body, reload only when
  // it says the decision landed.
  async function approveSeller() {
    setSubmitting(true);
    setSellerRejectError(null);
    setSellerDecisionError(null);
    try {
      const res = await fetch(`/api/admin/sellers/${id}/approve`, { method: "PUT" });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.success) {
        setSellerDecisionError(typeof body?.error === "string" ? body.error : "Approval was not recorded.");
        setSubmitting(false);
        return;
      }
      window.location.reload();
    } catch {
      setSellerDecisionError("Approval was not recorded.");
      setSubmitting(false);
    }
  }

  // Seller rejection is a recorded decision: the API requires a reason and
  // writes it to the audit log, so the button only fires once one is given.
  async function rejectSeller() {
    const reason = sellerRejectReason.trim();
    if (!reason) { setSellerRejectError("A reason is required."); return; }
    setSubmitting(true);
    setSellerRejectError(null);
    try {
      const res = await fetch(`/api/admin/sellers/${id}/reject`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.success) {
        setSellerRejectError(typeof body?.error === "string" ? body.error : "Rejection was not recorded.");
        setSubmitting(false);
        return;
      }
      window.location.reload();
    } catch {
      setSellerRejectError("Rejection was not recorded.");
      setSubmitting(false);
    }
  }

  if (loading) return <AdminLayout><div className="animate-pulse h-64 bg-muted rounded-2xl" /></AdminLayout>;
  if (!seller) return <AdminLayout><p>Seller not found</p></AdminLayout>;

  const s = seller as Record<string, unknown>;
  const docs = (s.documents as Record<string, unknown>[]) ?? [];
  // Computed by the API from the seller's own recent activity; null when there
  // is too little data. The stored `accountHealth` column is never recomputed
  // and is deliberately not shown.
  const performance = (s.performance as { score: number; windowDays: number } | null | undefined) ?? null;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Link href="/sellers" className="text-sm text-primary hover:underline">← Sellers</Link>
            <h1 className="text-2xl font-bold mt-1">{String(s.businessNameEn)}</h1>
            {Boolean(s.businessNameAr) && <p className="text-muted-foreground" dir="rtl">{String(s.businessNameAr)}</p>}
          </div>
          <div className="flex flex-col items-end gap-2">
            {sellerDecisionError && (
              <p role="alert" className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 shrink-0" />{sellerDecisionError}
              </p>
            )}
            <div className="flex gap-2">
            {s.status === "PENDING_REVIEW" && (
              <>
                <button onClick={approveSeller} disabled={submitting}
                  className="flex items-center gap-2 bg-green-500 text-white px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50">
                  <CheckCircle className="h-4 w-4" />Approve Seller
                </button>
                <button onClick={() => setRejectSellerOpen(true)}
                  className="flex items-center gap-2 bg-red-500 text-white px-4 py-2 rounded-xl text-sm font-semibold">
                  <XCircle className="h-4 w-4" />Reject
                </button>
              </>
            )}
            </div>
          </div>
        </div>

        {/* Seller info */}
        <div className="bg-white rounded-2xl border border-border p-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div><p className="text-xs text-muted-foreground">Status</p><p className="font-semibold">{String(s.status)}</p></div>
          <div><p className="text-xs text-muted-foreground">Tier</p><p className="font-semibold">{String(s.tier)}</p></div>
          <div><p className="text-xs text-muted-foreground">CR Number</p><p className="font-mono text-xs">{String(s.crNumber)}</p></div>
          <div><p className="text-xs text-muted-foreground">Commission</p><p className="font-semibold">{Number(s.commissionRate)}%</p></div>
          <div><p className="text-xs text-muted-foreground">Country</p><p>{String(s.country)} — {String(s.city)}</p></div>
          <div><p className="text-xs text-muted-foreground">Type</p><p>{String(s.type)}</p></div>
          {/* Averaged by the API over this seller's product reviews; the stored
              SellerProfile.rating column is never recomputed and is not read. */}
          <div><p className="text-xs text-muted-foreground">Rating</p><p>{s.rating ? `${Number(s.rating).toFixed(1)} ⭐ (${Number(s.reviewCount)} reviews)` : "No reviews yet"}</p></div>
          <div>
            <p className="text-xs text-muted-foreground">Performance score</p>
            {performance ? (
              <p className="font-bold">{performance.score}/100 <span className="text-xs font-normal text-muted-foreground">last {performance.windowDays} days</span></p>
            ) : (
              <p className="text-muted-foreground">Not enough data</p>
            )}
          </div>
        </div>

        {/* Reject seller form */}
        {rejectSellerOpen && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
            <p className="text-sm font-medium text-red-700 mb-2 flex items-center gap-2"><AlertTriangle className="h-4 w-4" />Reject this seller application — the reason is written to the audit log:</p>
            <textarea value={sellerRejectReason} onChange={(e) => setSellerRejectReason(e.target.value)} rows={2} className="w-full rounded-lg border border-red-300 p-2 text-sm" />
            {sellerRejectError && <p className="text-xs text-red-700 mt-1">{sellerRejectError}</p>}
            <div className="flex gap-2 mt-2">
              <button onClick={rejectSeller} disabled={submitting} className="bg-red-500 text-white px-3 py-1.5 rounded-lg text-sm font-semibold disabled:opacity-50">{submitting ? "Rejecting…" : "Confirm rejection"}</button>
              <button onClick={() => { setRejectSellerOpen(false); setSellerRejectReason(""); setSellerRejectError(null); }} className="px-3 py-1.5 rounded-lg text-sm border border-border">Cancel</button>
            </div>
          </div>
        )}

        {/* Document review */}
        <div className="bg-white rounded-2xl border border-border overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="font-semibold">Compliance Documents</h2>
          </div>
          <div className="divide-y divide-border">
            {/* An empty card is indistinguishable from a broken one; say that
                nothing was filed so the reviewer does not approve on silence. */}
            {docs.length === 0 && <p className="p-4 text-sm text-muted-foreground">No compliance documents have been filed by this seller.</p>}
            {docs.map((doc) => {
              const d = doc as Record<string, unknown>;
              return (
                <div key={String(d.id)} className="p-4 flex items-start gap-4">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{String(d.type).replace(/_/g, " ")}</p>
                    {/* The stored file reference is a private object key, not a
                        link, and the API does not ship it; the view route mints a
                        short-lived signed URL per request. */}
                    <a href={`/documents/${encodeURIComponent(String(d.id))}/view`} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                      <ExternalLink className="h-3 w-3" />{String(d.fileName)}
                    </a>
                    {Boolean(d.rejectionReason) && <p className="text-xs text-red-600 mt-1">{String(d.rejectionReason)}</p>}
                    {docNotice?.docId === String(d.id) && (
                      <p role="alert" className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1 mt-2 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3 shrink-0" />
                        <span>
                          {docNotice.message}
                          {docNotice.currentStatus && <> Current status: <strong>{docNotice.currentStatus.replace(/_/g, " ")}</strong>.</>}
                        </span>
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${String(d.status) === "APPROVED" ? "bg-green-100 text-green-700" : String(d.status) === "REJECTED" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}`}>{String(d.status).replace(/_/g, " ")}</span>
                    {String(d.status) === "PENDING_REVIEW" && (
                      <>
                        <button onClick={() => approveDoc(String(d.id))} disabled={docBusy === String(d.id)} className="text-xs bg-green-500 text-white px-2 py-1 rounded-lg hover:bg-green-600 disabled:opacity-50">Approve</button>
                        <button onClick={() => setRejectDocId(String(d.id))} disabled={docBusy === String(d.id)} className="text-xs bg-red-500 text-white px-2 py-1 rounded-lg hover:bg-red-600 disabled:opacity-50">Reject</button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Reject doc form */}
        {rejectDocId && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
            <p className="text-sm font-medium text-red-700 mb-2">Rejection reason:</p>
            <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={2} className="w-full rounded-lg border border-red-300 p-2 text-sm" />
            <div className="flex gap-2 mt-2">
              <button onClick={() => rejectDoc(rejectDocId)} disabled={docBusy === rejectDocId} className="bg-red-500 text-white px-3 py-1.5 rounded-lg text-sm font-semibold disabled:opacity-50">{docBusy === rejectDocId ? "Rejecting…" : "Confirm"}</button>
              <button onClick={() => { setRejectDocId(null); setRejectReason(""); setDocNotice(null); }} className="px-3 py-1.5 rounded-lg text-sm border border-border">Cancel</button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
