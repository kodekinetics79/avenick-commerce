"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, XCircle, Banknote, Loader2 } from "lucide-react";

interface Props {
  returnId: string;
  status: string;
  orderTotal: number;
}

export function ReturnActions({ returnId, status, orderTotal }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function transition(nextStatus: string, opts?: { resolution?: string; refundAmount?: number }) {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/returns/${returnId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus, ...opts }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error ?? "Failed to update return");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error — please retry");
    } finally {
      setPending(false);
    }
  }

  function approve() {
    const resolution = window.prompt("Approve this return?\n\nResolution note (optional):");
    if (resolution === null) return;
    void transition("APPROVED", { resolution: resolution.trim() || undefined });
  }

  function reject() {
    const resolution = window.prompt("Reject this return?\n\nReason (shared with the buyer):");
    if (resolution === null) return;
    if (!resolution.trim()) {
      setError("A rejection reason is required");
      return;
    }
    void transition("REJECTED", { resolution: resolution.trim() });
  }

  function refund() {
    const input = window.prompt(
      `Refund this return? A pending refund will be created on the order.\n\nRefund amount (max ${orderTotal.toFixed(2)}):`,
      orderTotal.toFixed(2),
    );
    if (input === null) return;
    const amount = Number(input);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter a valid refund amount");
      return;
    }
    void transition("REFUNDED", { refundAmount: amount });
  }

  const btn = "inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-colors disabled:opacity-50";
  const spinner = pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap gap-1.5">
        {status === "REQUESTED" && (
          <>
            <button type="button" onClick={approve} disabled={pending} className={`${btn} border-green-200 text-green-700 hover:bg-green-50`}>
              {spinner ?? <CheckCircle className="h-3.5 w-3.5" />} Approve
            </button>
            <button type="button" onClick={reject} disabled={pending} className={`${btn} border-red-200 text-red-600 hover:bg-red-50`}>
              {spinner ?? <XCircle className="h-3.5 w-3.5" />} Reject
            </button>
          </>
        )}
        {["APPROVED", "RECEIVED"].includes(status) && (
          <button type="button" onClick={refund} disabled={pending} className={`${btn} border-blue-200 text-primary hover:bg-blue-50`}>
            {spinner ?? <Banknote className="h-3.5 w-3.5" />} Refund
          </button>
        )}
        {["REJECTED", "REFUNDED", "IN_TRANSIT"].includes(status) && (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </div>
      {error && <span className="text-[11px] text-red-600">{error}</span>}
    </div>
  );
}
