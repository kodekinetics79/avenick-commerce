"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { AdminLayout } from "@/components/layout/admin-layout";
import { CheckCircle, XCircle, ExternalLink, AlertTriangle } from "lucide-react";
import { formatCurrency } from "@manzil/utils";
import Link from "next/link";

export default function SellerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [seller, setSeller] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [rejectDocId, setRejectDocId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  useEffect(() => {
    fetch(`/api/admin/sellers/${id}`)
      .then((r) => r.json())
      .then((d) => { setSeller(d.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id]);

  async function approveDoc(docId: string) {
    await fetch(`/api/admin/compliance/${docId}/approve`, { method: "PUT" });
    window.location.reload();
  }

  async function rejectDoc(docId: string) {
    await fetch(`/api/admin/compliance/${docId}/reject`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: rejectReason }),
    });
    window.location.reload();
  }

  if (loading) return <AdminLayout><div className="animate-pulse h-64 bg-muted rounded-2xl" /></AdminLayout>;
  if (!seller) return <AdminLayout><p>Seller not found</p></AdminLayout>;

  const s = seller as Record<string, unknown>;
  const docs = (s.documents as Record<string, unknown>[]) ?? [];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Link href="/sellers" className="text-sm text-blue-600 hover:underline">← Sellers</Link>
            <h1 className="text-2xl font-bold mt-1">{String(s.businessNameEn)}</h1>
            {Boolean(s.businessNameAr) && <p className="text-muted-foreground" dir="rtl">{String(s.businessNameAr)}</p>}
          </div>
          <div className="flex gap-2">
            {s.status === "PENDING_REVIEW" && (
              <>
                <button onClick={() => fetch(`/api/admin/sellers/${id}/approve`, { method: "PUT" }).then(() => window.location.reload())}
                  className="flex items-center gap-2 bg-green-500 text-white px-4 py-2 rounded-xl text-sm font-semibold">
                  <CheckCircle className="h-4 w-4" />Approve Seller
                </button>
                <button className="flex items-center gap-2 bg-red-500 text-white px-4 py-2 rounded-xl text-sm font-semibold">
                  <XCircle className="h-4 w-4" />Reject
                </button>
              </>
            )}
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
          <div><p className="text-xs text-muted-foreground">Rating</p><p>{s.rating ? `${Number(s.rating).toFixed(1)} ⭐` : "—"}</p></div>
          <div><p className="text-xs text-muted-foreground">Account Health</p><p className="font-bold">{Number(s.accountHealth)}/100</p></div>
        </div>

        {/* Document review */}
        <div className="bg-white rounded-2xl border border-border overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="font-semibold">Compliance Documents</h2>
          </div>
          <div className="divide-y divide-border">
            {docs.map((doc) => {
              const d = doc as Record<string, unknown>;
              return (
                <div key={String(d.id)} className="p-4 flex items-start gap-4">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{String(d.type).replace(/_/g, " ")}</p>
                    <a href={String(d.fileUrl)} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                      <ExternalLink className="h-3 w-3" />{String(d.fileName)}
                    </a>
                    {Boolean(d.rejectionReason) && <p className="text-xs text-red-600 mt-1">{String(d.rejectionReason)}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${String(d.status) === "APPROVED" ? "bg-green-100 text-green-700" : String(d.status) === "REJECTED" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}`}>{String(d.status).replace(/_/g, " ")}</span>
                    {String(d.status) === "PENDING_REVIEW" && (
                      <>
                        <button onClick={() => approveDoc(String(d.id))} className="text-xs bg-green-500 text-white px-2 py-1 rounded-lg hover:bg-green-600">Approve</button>
                        <button onClick={() => setRejectDocId(String(d.id))} className="text-xs bg-red-500 text-white px-2 py-1 rounded-lg hover:bg-red-600">Reject</button>
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
              <button onClick={() => rejectDoc(rejectDocId)} className="bg-red-500 text-white px-3 py-1.5 rounded-lg text-sm font-semibold">Confirm</button>
              <button onClick={() => { setRejectDocId(null); setRejectReason(""); }} className="px-3 py-1.5 rounded-lg text-sm border border-border">Cancel</button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
