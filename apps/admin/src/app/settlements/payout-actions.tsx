"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, Loader2, RefreshCw } from "lucide-react";

interface Props {
  payoutId: string;
  status: string;
}

export function PayoutActions({ payoutId, status }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function advance(nextStatus: "PROCESSING" | "PAID") {
    const prompts: Record<string, string> = {
      PROCESSING: "Start processing this payout? It will be marked as in transfer.",
      PAID: "Mark this payout as settled? Commissions on its orders will be marked settled. This cannot be undone.",
    };
    let reference: string | undefined;
    if (nextStatus === "PAID") {
      const input = window.prompt(`${prompts[nextStatus]}\n\nBank/transfer reference (optional):`);
      if (input === null) return;
      reference = input.trim() || undefined;
    } else if (!window.confirm(prompts[nextStatus])) {
      return;
    }

    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/payouts/${payoutId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus, reference }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error ?? "Failed to update payout");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error — please retry");
    } finally {
      setPending(false);
    }
  }

  if (status === "PAID") return <span className="text-xs text-muted-foreground">Settled</span>;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-1.5">
        {status === "PENDING" && (
          <button
            type="button"
            onClick={() => advance("PROCESSING")}
            disabled={pending}
            className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-blue-200 text-primary hover:bg-blue-50 transition-colors disabled:opacity-50"
          >
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Process
          </button>
        )}
        <button
          type="button"
          onClick={() => advance("PAID")}
          disabled={pending}
          className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-green-200 text-green-700 hover:bg-green-50 transition-colors disabled:opacity-50"
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
          Mark settled
        </button>
      </div>
      {error && <span className="text-[11px] text-red-600">{error}</span>}
    </div>
  );
}
