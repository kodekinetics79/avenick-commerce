"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, CheckCircle2, Loader2 } from "lucide-react";

interface Props {
  companyId: string;
  status: string;
}

export function CompanyStatusActions({ companyId, status }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function changeStatus(nextStatus: "ACTIVE" | "SUSPENDED") {
    const verb = nextStatus === "SUSPENDED" ? "Suspend" : "Activate";
    const warning =
      nextStatus === "SUSPENDED"
        ? "Their members will lose access to B2B purchasing."
        : "The company will be marked active and verified.";
    if (!window.confirm(`${verb} this company? ${warning}`)) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/companies/${companyId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error ?? "Failed to update status");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error — please retry");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-1.5">
        {status !== "ACTIVE" && (
          <button
            type="button"
            onClick={() => changeStatus("ACTIVE")}
            disabled={pending}
            className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-green-200 text-green-700 hover:bg-green-50 transition-colors disabled:opacity-50"
          >
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            {status === "PENDING_VERIFICATION" ? "Verify" : "Activate"}
          </button>
        )}
        {status === "ACTIVE" && (
          <button
            type="button"
            onClick={() => changeStatus("SUSPENDED")}
            disabled={pending}
            className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ban className="h-3.5 w-3.5" />}
            Suspend
          </button>
        )}
      </div>
      {error && <span className="text-[11px] text-red-600">{error}</span>}
    </div>
  );
}
