"use client";

import * as React from "react";
import { Bell, CheckCheck, ShoppingCart, DollarSign, FileCheck, FileQuestion, Package, Info } from "lucide-react";
import { cn } from "@avenick/utils";
import { EmptyState, Eyebrow, Surface } from "@avenick/ui";
import { useToast } from "@/components/toast";

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
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [items, setItems] = React.useState<Notif[]>([]);
  const [unread, setUnread] = React.useState(0);
  const ref = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const panelId = React.useId();

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
    // Escape closes the panel and hands focus back to the bell. Without it a
    // keyboard user who opened this had no way out but tabbing through every
    // notification in the list.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || !open) return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  /**
   * Optimistic, but only until the server disagrees.
   *
   * The response was previously awaited and then thrown away, so a rejected or
   * failed write left every row rendered as read while the server still held
   * them unread — the badge would come back on the next poll and the seller
   * would have no idea which of the two readings was true. The optimistic paint
   * is kept, because it is what makes the control feel instant; what is added is
   * that a failure re-reads the real state and says so.
   */
  async function markAll() {
    const previousItems = items;
    const previousUnread = unread;
    setUnread(0);
    setItems((p) => p.map((n) => ({ ...n, isRead: true })));
    try {
      const response = await fetch("/api/notifications", { method: "POST", body: "{}" });
      if (!response.ok) throw new Error(String(response.status));
      await load();
    } catch {
      setItems(previousItems);
      setUnread(previousUnread);
      toast({ title: "Couldn't mark these as read", description: "They are still unread. Try again.", variant: "error" });
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => { setOpen((o) => !o); if (!open) load(); }}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={panelId}
        className="u-focus relative grid h-9 w-9 place-items-center rounded-nested text-ink-2 transition-colors duration-press ease-standard hover:bg-ink-1/[0.06] hover:text-ink-1"
        aria-label={unread > 0 ? `Notifications (${unread > 9 ? "9+" : unread} unread)` : "Notifications"}
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
        {unread > 0 && (
          // end-1, never right-1: the count belongs on the trailing corner of the
          // bell in Arabic as well as in English.
          <span
            aria-hidden="true"
            className="absolute end-1 top-1 grid h-4 min-w-4 place-items-center rounded-pill bg-danger px-1 text-micro font-medium text-danger-foreground"
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        // Rung 4 and NOT glass. This panel is a list of sentences, and law 5 does
        // not allow their contrast to depend on what happens to be behind it.
        <Surface
          rung={4}
          id={panelId}
          className="absolute end-0 top-full z-layer mt-1.5 w-80 max-w-[calc(100vw-2rem)] overflow-hidden"
        >
          <div className="flex items-center justify-between gap-2 border-b border-hairline px-4 py-3">
            <Eyebrow>Notifications</Eyebrow>
            {unread > 0 && (
              <button
                type="button"
                onClick={markAll}
                className="u-focus u-meta inline-flex items-center gap-1 rounded-nested px-1 py-0.5 font-medium text-primary-ink hover:underline"
              >
                <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" /> Mark all read
              </button>
            )}
          </div>
          <div className="max-h-[60vh] overflow-y-auto scrollbar-thin">
            {items.length === 0 ? (
              // The editorial blank, not a 32px greyed bell that reads as a fault.
              // It states precisely what is empty rather than congratulating anyone.
              <EmptyState
                className="px-4 py-10"
                eyebrow="Nothing waiting"
                headline="No notifications on this account."
                body="Order, payout, compliance and RFQ events appear here as they are recorded."
              />
            ) : (
              items.map((n) => {
                const Icon = ICON[n.type] ?? Info;
                return (
                  <div
                    key={n.id}
                    className={cn(
                      // The unread mark is a 2px inline-start rule that is always
                      // present and only changes colour, so reading a notification
                      // never reflows the list under the pointer.
                      "flex gap-3 border-b border-hairline border-s-2 px-4 py-3 last:border-b-0",
                      n.isRead ? "border-s-transparent" : "border-s-primary",
                    )}
                  >
                    <span
                      className={cn(
                        "grid h-8 w-8 shrink-0 place-items-center rounded-nested",
                        n.isRead ? "bg-neutral-soft text-ink-3" : "bg-primary-soft text-primary-ink",
                      )}
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <p className={cn("u-ui leading-snug", n.isRead ? "text-ink-2" : "font-medium text-ink-1")}>{n.titleEn}</p>
                      {n.bodyEn && <p className="u-meta mt-0.5 line-clamp-2 text-ink-2">{n.bodyEn}</p>}
                      <p className="u-meta mt-1 text-ink-3">{ago(n.createdAt)}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Surface>
      )}
    </div>
  );
}
