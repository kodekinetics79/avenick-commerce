"use client";

import * as React from "react";
import { Bell, CheckCheck, ShoppingCart, DollarSign, FileCheck, FileQuestion, Package, Info } from "lucide-react";

type Notif = { id: string; type: string; titleEn: string; bodyEn: string; isRead: boolean; createdAt: string };

const ICON: Record<string, React.ElementType> = {
  ORDER_UPDATE: ShoppingCart, PAYMENT: DollarSign, PAYOUT: DollarSign, COMPLIANCE: FileCheck,
  RFQ: FileQuestion, INVENTORY: Package, MESSAGE: Info, SYSTEM: Info,
};

function ago(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function NotificationBell() {
  const [open, setOpen] = React.useState(false);
  const [items, setItems] = React.useState<Notif[]>([]);
  const [unread, setUnread] = React.useState(0);
  const ref = React.useRef<HTMLDivElement>(null);

  const load = React.useCallback(async () => {
    try {
      const r = await fetch("/api/notifications", { cache: "no-store" });
      const d = await r.json();
      setItems(d.data?.items ?? []);
      setUnread(d.data?.unread ?? 0);
    } catch {
      /* ignore */
    }
  }, []);

  React.useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  React.useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function markAll() {
    setUnread(0);
    setItems((p) => p.map((n) => ({ ...n, isRead: true })));
    await fetch("/api/notifications", { method: "POST", body: "{}" });
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => { setOpen((o) => !o); if (!open) load(); }}
        className="relative p-2 hover:bg-secondary rounded-lg transition-colors"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5 text-muted-foreground" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 h-4 min-w-4 px-1 bg-danger text-white text-[9px] rounded-full flex items-center justify-center font-bold">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute end-0 top-full mt-1.5 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-popover text-popover-foreground shadow-elevated z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <p className="text-sm font-semibold">Notifications</p>
            {unread > 0 && (
              <button type="button" onClick={markAll} className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium">
                <CheckCheck className="h-3.5 w-3.5" /> Mark all read
              </button>
            )}
          </div>
          <div className="max-h-[60vh] overflow-y-auto scrollbar-hide">
            {items.length === 0 ? (
              <div className="px-4 py-10 text-center text-muted-foreground">
                <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">You're all caught up.</p>
              </div>
            ) : (
              items.map((n) => {
                const Icon = ICON[n.type] ?? Info;
                return (
                  <div key={n.id} className={`flex gap-3 px-4 py-3 border-b border-border last:border-0 ${!n.isRead ? "bg-primary/5" : ""}`}>
                    <span className={`grid h-8 w-8 place-items-center rounded-lg shrink-0 ${!n.isRead ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground"}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium leading-snug">{n.titleEn}</p>
                      {n.bodyEn && <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{n.bodyEn}</p>}
                      <p className="text-[11px] text-muted-foreground mt-1">{ago(n.createdAt)}</p>
                    </div>
                    {!n.isRead && <span className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5" />}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
