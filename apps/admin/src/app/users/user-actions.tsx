"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, CheckCircle2, Loader2 } from "lucide-react";

interface Props {
  userId: string;
  status: string;
  isSelf: boolean;
}

export function UserStatusActions({ userId, status, isSelf }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isSelf) return <span className="text-xs text-muted-foreground">—</span>;

  const suspend = status === "ACTIVE";
  const nextStatus = suspend ? "SUSPENDED" : "ACTIVE";

  async function changeStatus() {
    const verb = suspend ? "Suspend" : "Activate";
    if (!window.confirm(`${verb} this user? ${suspend ? "They will no longer be able to sign in." : "They will regain access immediately."}`)) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}/status`, {
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
      <button
        type="button"
        onClick={changeStatus}
        disabled={pending}
        className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-colors disabled:opacity-50 ${
          suspend
            ? "border-red-200 text-red-600 hover:bg-red-50"
            : "border-green-200 text-green-700 hover:bg-green-50"
        }`}
      >
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : suspend ? <Ban className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
        {suspend ? "Suspend" : "Activate"}
      </button>
      {error && <span className="text-[11px] text-red-600">{error}</span>}
    </div>
  );
}
