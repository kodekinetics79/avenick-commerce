"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard, TrendingUp, Package, Boxes, ShoppingCart, Truck, RotateCcw,
  FileQuestion, DollarSign, FileText, CreditCard, FolderOpen, CheckSquare,
  MessageSquare, Settings, Search, CornerDownLeft, BarChart3, Plus, Sparkles,
} from "lucide-react";

type Item = { label: string; href: string; icon: React.ElementType; keywords?: string; group: string };

const ITEMS: Item[] = [
  { group: "Go to", label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, keywords: "home overview" },
  { group: "Go to", label: "Analytics", href: "/analytics", icon: BarChart3, keywords: "sales charts insights" },
  { group: "Go to", label: "Performance", href: "/performance", icon: TrendingUp, keywords: "score rating health" },
  { group: "Go to", label: "Products", href: "/products", icon: Package, keywords: "catalog listings" },
  { group: "Go to", label: "Inventory", href: "/inventory", icon: Boxes, keywords: "stock" },
  { group: "Go to", label: "Orders", href: "/orders", icon: ShoppingCart },
  { group: "Go to", label: "Shipments", href: "/shipments", icon: Truck, keywords: "fulfilment tracking" },
  { group: "Go to", label: "Returns", href: "/returns", icon: RotateCcw },
  { group: "Go to", label: "Quotes", href: "/quotes", icon: FileQuestion, keywords: "rfq" },
  { group: "Go to", label: "Messages & RFQ inbox", href: "/messages", icon: MessageSquare, keywords: "rfq chat" },
  { group: "Go to", label: "Payouts", href: "/payouts", icon: DollarSign },
  { group: "Go to", label: "Invoices", href: "/invoices", icon: FileText },
  { group: "Go to", label: "Commission", href: "/commission", icon: CreditCard },
  { group: "Go to", label: "Documents", href: "/documents", icon: FolderOpen },
  { group: "Go to", label: "Compliance", href: "/compliance", icon: CheckSquare, keywords: "onboarding" },
  { group: "Go to", label: "Settings", href: "/settings", icon: Settings },
  { group: "Actions", label: "Add a product", href: "/products?new=1", icon: Plus },
  { group: "Actions", label: "View RFQ inbox", href: "/messages", icon: FileQuestion },
  { group: "Actions", label: "AI assist", href: "/messages?ai=1", icon: Sparkles, keywords: "draft generate" },
];

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [active, setActive] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("open-command-palette", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("open-command-palette", onOpen);
    };
  }, []);

  React.useEffect(() => {
    if (open) {
      setQ("");
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  const filtered = React.useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return ITEMS;
    return ITEMS.filter((i) => i.label.toLowerCase().includes(s) || i.keywords?.includes(s) || i.group.toLowerCase().includes(s));
  }, [q]);

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
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] px-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
      <div className="relative w-full max-w-xl rounded-2xl border border-border bg-popover text-popover-foreground shadow-elevated overflow-hidden animate-fade-up">
        <div className="flex items-center gap-2 px-4 border-b border-border">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => { setQ(e.target.value); setActive(0); }}
            onKeyDown={onInputKey}
            placeholder="Search pages and actions…"
            className="flex-1 h-12 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="hidden sm:inline text-[10px] font-mono text-muted-foreground border border-border rounded px-1.5 py-0.5">ESC</kbd>
        </div>
        <div className="max-h-[50vh] overflow-y-auto p-2 scrollbar-hide">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No results for “{q}”.</p>
          ) : (
            groups.map((g) => (
              <div key={g} className="mb-1">
                <p className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">{g}</p>
                {filtered.filter((i) => i.group === g).map((item) => {
                  idx++;
                  const isActive = idx === active;
                  const myIdx = idx;
                  return (
                    <button
                      key={item.label}
                      type="button"
                      onMouseEnter={() => setActive(myIdx)}
                      onClick={() => go(item)}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors ${isActive ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span className="flex-1 text-start">{item.label}</span>
                      {isActive && <CornerDownLeft className="h-3.5 w-3.5 opacity-70" />}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
        <div className="flex items-center justify-between px-4 py-2 border-t border-border text-[11px] text-muted-foreground">
          <span className="flex items-center gap-2"><kbd className="font-mono border border-border rounded px-1">↑↓</kbd> navigate <kbd className="font-mono border border-border rounded px-1">↵</kbd> open</span>
          <span className="flex items-center gap-1"><Sparkles className="h-3 w-3 text-primary" /> Avenick command palette</span>
        </div>
      </div>
    </div>
  );
}
