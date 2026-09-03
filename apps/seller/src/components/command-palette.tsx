"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard, TrendingUp, Package, Boxes, ShoppingCart, Truck, RotateCcw,
  FileQuestion, DollarSign, FileText, CreditCard, FolderOpen, CheckSquare,
  MessageSquare, Settings, Search, CornerDownLeft, BarChart3, Plus, Sparkles,
} from "lucide-react";
import { cn } from "@avenick/utils";
import { Eyebrow, Surface } from "@avenick/ui";
import { sellerNavigationAllows } from "@/lib/seller-permissions";

type Item = { label: string; href: string; icon: React.ElementType; keywords?: string; group: string; permissions?: string[]; allPermissions?: string[] };

const ITEMS: Item[] = [
  { group: "Go to", label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, keywords: "home overview", permissions: ["dashboard.view"] },
  { group: "Go to", label: "Analytics", href: "/analytics", icon: BarChart3, keywords: "sales charts insights", permissions: ["analytics.view"] },
  { group: "Go to", label: "Performance", href: "/performance", icon: TrendingUp, keywords: "score rating health", permissions: ["analytics.view"] },
  { group: "Go to", label: "Products", href: "/products", icon: Package, keywords: "catalog listings", permissions: ["catalog.view", "catalog.manage"] },
  { group: "Go to", label: "Inventory", href: "/inventory", icon: Boxes, keywords: "stock", permissions: ["inventory.view", "inventory.manage"] },
  { group: "Go to", label: "Orders", href: "/orders", icon: ShoppingCart, permissions: ["orders.view", "orders.fulfill"] },
  { group: "Go to", label: "Shipments", href: "/shipments", icon: Truck, keywords: "fulfilment tracking", permissions: ["shipments.view", "shipments.manage"] },
  { group: "Go to", label: "Returns", href: "/returns", icon: RotateCcw, permissions: ["returns.view", "returns.manage"] },
  { group: "Go to", label: "Quotes", href: "/quotes", icon: FileQuestion, keywords: "rfq", permissions: ["rfqs.view"] },
  { group: "Go to", label: "Messages & RFQ inbox", href: "/messages", icon: MessageSquare, keywords: "rfq chat", permissions: ["rfqs.view"] },
  { group: "Go to", label: "Payouts", href: "/payouts", icon: DollarSign, permissions: ["finance.view"] },
  { group: "Go to", label: "Invoices", href: "/invoices", icon: FileText, permissions: ["finance.view"] },
  { group: "Go to", label: "Commission", href: "/commission", icon: CreditCard, permissions: ["finance.view"] },
  { group: "Go to", label: "Documents", href: "/documents", icon: FolderOpen, permissions: ["documents.view", "documents.manage"] },
  { group: "Go to", label: "Compliance", href: "/compliance", icon: CheckSquare, keywords: "onboarding", permissions: ["documents.view", "documents.manage"] },
  { group: "Go to", label: "Settings", href: "/settings", icon: Settings, permissions: ["settings.manage"] },
  { group: "Actions", label: "Add a product", href: "/products/new", icon: Plus, allPermissions: ["catalog.manage", "pricing.manage"] },
  { group: "Actions", label: "View RFQ inbox", href: "/messages", icon: FileQuestion, permissions: ["rfqs.view"] },
  { group: "Actions", label: "AI assist", href: "/messages?ai=1", icon: Sparkles, keywords: "draft generate", permissions: ["rfqs.view"] },
];

export function CommandPalette({ permissions = [] }: { permissions?: readonly string[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [active, setActive] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const listId = React.useId();
  // The element that had focus when the palette opened, so it can be given back.
  const restoreRef = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        // Never open UNDER an open <Layer>. A layer is a real focus trap, so the
        // palette would take the focus, the trap would immediately take it back,
        // and the user would be typing into a box they cannot see.
        if (document.querySelector("[data-layer]")) return;
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    const onOpen = () => { if (!document.querySelector("[data-layer]")) setOpen(true); };
    window.addEventListener("keydown", onKey);
    window.addEventListener("open-command-palette", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("open-command-palette", onOpen);
    };
  }, []);

  React.useEffect(() => {
    if (!open) return;
    setQ("");
    setActive(0);
    // Remember where focus came from and lock the page behind the palette. A
    // dialog that leaves the document scrolling underneath it, and drops focus
    // on the body when it closes, is a dialog only for people using a mouse.
    restoreRef.current = document.activeElement as HTMLElement | null;

    /**
     * Lock the elements that actually scroll.
     *
     * Locking document.body alone was a no-op in every one of these portals: the
     * shells are `h-screen overflow-hidden` and the scrolling box is the <main>
     * inside them, which is why the page went on scrolling behind the palette
     * under the wheel. The shell marks that box with data-scroll-container; body
     * stays in the list for any surface that does scroll the document.
     */
    const locked: Array<[HTMLElement, string]> = [
      document.body,
      ...Array.from(document.querySelectorAll<HTMLElement>("[data-scroll-container]")),
    ].map((el) => [el, el.style.overflow]);
    locked.forEach(([el]) => { el.style.overflow = "hidden"; });

    const focusTimer = setTimeout(() => inputRef.current?.focus(), 10);
    return () => {
      clearTimeout(focusTimer);
      locked.forEach(([el, previous]) => { el.style.overflow = previous; });
      restoreRef.current?.focus?.();
    };
  }, [open]);

  /**
   * The focus trap.
   *
   * This element already declares role="dialog" aria-modal="true", which tells a
   * screen reader the rest of the page is inert — but it is only a promise. Tab
   * walked straight off the last result and into the sidebar links behind the
   * scrim, so a keyboard user ended up driving a page they could not see while
   * assistive technology insisted it was hidden. A dialog that claims to be modal
   * has to hold the focus it claims.
   */
  React.useEffect(() => {
    if (!open) return;
    const onTab = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const current = document.activeElement;
      if (event.shiftKey && (current === first || !dialogRef.current.contains(current))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && current === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onTab);
    return () => document.removeEventListener("keydown", onTab);
  }, [open]);

  const filtered = React.useMemo(() => {
    const s = q.trim().toLowerCase();
    const allowed = ITEMS.filter((item) =>
      (!item.permissions || sellerNavigationAllows(permissions, item.permissions))
      && (!item.allPermissions || item.allPermissions.every((permission) => sellerNavigationAllows(permissions, [permission]))),
    );
    if (!s) return allowed;
    return allowed.filter((i) => i.label.toLowerCase().includes(s) || i.keywords?.includes(s) || i.group.toLowerCase().includes(s));
  }, [q, permissions]);

  function go(item: Item) {
    setOpen(false);
    router.push(item.href);
  }

  function onInputKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, filtered.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (filtered[active]) go(filtered[active]); }
  }

  if (!open) return null;

  const groups = [...new Set(filtered.map((i) => i.group))];
  let idx = -1;

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-layer flex items-start justify-center px-4 pt-[12vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Search pages and actions"
    >
      {/* The system scrim: hue-matched, blurred and darkened by one token pair,
          rather than a raw rgba black that has no dark-mode counterpart. */}
      <div aria-hidden="true" className="u-layer-scrim" onClick={() => setOpen(false)} />
      {/* Rung 5 — the palette is the frontmost layer in the product while it is
          open, and rung 5 is the only other place glass is permitted. */}
      <Surface rung={5} glass className="relative z-[51] w-full max-w-xl animate-fade-up overflow-hidden">
        <div className="flex items-center gap-2 border-b border-hairline px-4">
          <Search className="h-4 w-4 shrink-0 text-ink-3" aria-hidden="true" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => { setQ(e.target.value); setActive(0); }}
            onKeyDown={onInputKey}
            placeholder="Search pages and actions…"
            aria-label="Search pages and actions"
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={filtered[active] ? `${listId}-${active}` : undefined}
            aria-autocomplete="list"
            className="u-body h-12 flex-1 bg-transparent text-ink-1 outline-none placeholder:text-ink-3"
          />
          <kbd className="u-mono hidden rounded-sm border border-border px-1.5 py-0.5 text-micro text-ink-3 sm:inline">ESC</kbd>
        </div>
        <div id={listId} role="listbox" aria-label="Results" className="max-h-[50vh] overflow-y-auto p-2 scrollbar-thin">
          {filtered.length === 0 ? (
            <p className="u-provenance py-8 text-center text-ui text-ink-2">Nothing matches “{q}”.</p>
          ) : (
            groups.map((g) => (
              <div key={g} role="group" aria-label={g} className="mb-1">
                <Eyebrow className="px-2 py-1">{g}</Eyebrow>
                {filtered.filter((i) => i.group === g).map((item) => {
                  idx++;
                  const isActive = idx === active;
                  const myIdx = idx;
                  return (
                    <button
                      key={item.label}
                      id={`${listId}-${myIdx}`}
                      role="option"
                      aria-selected={isActive}
                      type="button"
                      onMouseEnter={() => setActive(myIdx)}
                      onClick={() => go(item)}
                      className={cn(
                        "u-ui relative flex w-full items-center gap-2.5 rounded-nested px-3 py-2",
                        "transition-colors duration-press ease-standard",
                        isActive ? "bg-ink-1/[0.06] font-medium text-ink-1" : "text-ink-2 hover:bg-ink-1/[0.04] hover:text-ink-1",
                      )}
                    >
                      {/* The same drawn brass rule that marks the current page in
                          the sidebar — one active-indicator gesture, used
                          everywhere, is what makes the two feel designed rather
                          than assembled. It is also brass's one permitted use
                          outside a tier mark. */}
                      <span
                        aria-hidden="true"
                        className="u-drawn absolute inset-y-1 start-0"
                        data-orientation="vertical"
                        data-on={isActive ? "true" : "false"}
                      />
                      <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span className="flex-1 text-start">{item.label}</span>
                      {isActive && <CornerDownLeft className="h-3.5 w-3.5 text-ink-3 rtl:-scale-x-100" aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
        {/* The footer used to end with a "Avenick command palette" signature: a
            hardcoded platform name carrying no information. The keyboard contract
            is the only thing here a reader can act on. */}
        <div className="flex items-center gap-2 border-t border-hairline px-4 py-2 text-meta text-ink-3">
          <kbd className="u-mono rounded-sm border border-border px-1">↑↓</kbd> navigate
          <kbd className="u-mono ms-2 rounded-sm border border-border px-1">↵</kbd> open
        </div>
      </Surface>
    </div>
  );
}
