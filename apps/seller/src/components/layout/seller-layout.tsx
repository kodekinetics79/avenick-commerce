"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, TrendingUp,
  Package, Boxes, AlertTriangle,
  ShoppingCart, Truck, RotateCcw,
  Inbox, Send, Clock,
  DollarSign, FileText, CreditCard,
  FolderOpen, CheckSquare,
  LifeBuoy, MessageSquare,
  Settings, Menu, ChevronDown, Star, LogOut, Search, BarChart3, Info
} from "lucide-react";
import { signOut } from "next-auth/react";
import { cn } from "@avenick/utils";
import { ThemeToggle } from "@avenick/ui";
import { CommandPalette } from "@/components/command-palette";
import { NotificationBell } from "@/components/notification-bell";
import { ToastProvider } from "@/components/toast";
import { sellerNavigationAllows } from "@/lib/seller-permissions";

export const NAV_GROUPS = [
  {
    label: "Overview",
    items: [
      { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard", permissions: ["dashboard.view"] },
      { href: "/analytics", icon: BarChart3, label: "Analytics", permissions: ["analytics.view"] },
      { href: "/performance", icon: TrendingUp, label: "Performance", permissions: ["analytics.view"] },
    ],
  },
  {
    label: "Catalog",
    items: [
      { href: "/products", icon: Package, label: "Products", permissions: ["catalog.view", "catalog.manage"] },
      { href: "/inventory", icon: Boxes, label: "Inventory", permissions: ["inventory.view", "inventory.manage"] },
      // /issues renders "Fix Your Products" (listing issues) — it was never a bulk uploader.
      { href: "/issues", icon: AlertTriangle, label: "Listing Issues", badge: "issues", permissions: ["catalog.view", "catalog.manage"] },
    ],
  },
  {
    label: "Orders",
    items: [
      { href: "/orders", icon: ShoppingCart, label: "Orders", permissions: ["orders.view", "orders.fulfill"] },
      { href: "/shipments", icon: Truck, label: "Shipments", permissions: ["shipments.view", "shipments.manage"] },
      { href: "/returns", icon: RotateCcw, label: "Returns", permissions: ["returns.view", "returns.manage"] },
    ],
  },
  {
    label: "RFQ / Quotes",
    items: [
      // /messages is "Messages & RFQs": buyer threads and RFQs share one inbox.
      { href: "/messages", icon: Inbox, label: "Inbox", badge: "messages", permissions: ["rfqs.view"] },
      { href: "/quotes/submit", icon: Send, label: "Submit Quote", permissions: ["quotes.submit"] },
      { href: "/quotes", icon: Clock, label: "Quote History", permissions: ["rfqs.view"] },
    ],
  },
  {
    label: "Finance",
    items: [
      { href: "/payouts", icon: DollarSign, label: "Payouts", permissions: ["finance.view"] },
      { href: "/invoices", icon: FileText, label: "Invoices", permissions: ["finance.view"] },
      { href: "/commission", icon: CreditCard, label: "Commission", permissions: ["finance.view"] },
    ],
  },
  {
    label: "Documents",
    items: [
      { href: "/documents", icon: FolderOpen, label: "Document Center", permissions: ["documents.view", "documents.manage"] },
      // /compliance renders "Compliance"; onboarding is the dashboard checklist, not this page.
      { href: "/compliance", icon: CheckSquare, label: "Compliance", permissions: ["documents.view", "documents.manage"] },
    ],
  },
  {
    label: "Support",
    items: [
      { href: "/support/tickets", icon: LifeBuoy, label: "Tickets", permissions: ["support.view"] },
      { href: "/support/contact", icon: MessageSquare, label: "Contact Admin", permissions: ["support.view"] },
    ],
  },
];

/**
 * Structural mirror of SellerPerformanceScore from @avenick/database. Declared
 * here rather than imported so this client bundle never reaches for the
 * database barrel; the dashboard passes the service result straight through.
 */
export interface PerformanceComponentView {
  key: string;
  label: string;
  weight: number;
  /** Share in 0..1, or null when the component had no data and was left out. */
  share: number | null;
  good: number;
  total: number;
}

export interface PerformanceView {
  score: number;
  windowDays: number;
  components: PerformanceComponentView[];
}

interface SellerLayoutProps {
  children: React.ReactNode;
  /** The seller's own business name. No default: a made-up name is worse than no name. */
  sellerName?: string;
  tier?: string;
  issueCount?: number;
  unreadMessages?: number;
  /**
   * Three states, all honest:
   *  - undefined: this page did not compute a score → the widget is not shown.
   *  - null: computed, but the seller has too little activity to state one.
   *  - object: a real score derived from the seller's own records.
   * There is deliberately no default; the sidebar used to show 87 to everyone.
   */
  performance?: PerformanceView | null;
  permissions?: readonly string[];
}

/** Band thresholds are presentation only — they colour the number, they do not produce it. */
function scoreTone(score: number) {
  if (score >= 80) return { text: "text-success", box: "bg-success/10 border-success/30", fill: "bg-success" };
  if (score >= 60) return { text: "text-warning", box: "bg-warning/10 border-warning/30", fill: "bg-warning" };
  return { text: "text-danger", box: "bg-danger/10 border-danger/30", fill: "bg-danger" };
}

/**
 * Sidebar pill for the performance score. Lives at module scope so it has a
 * stable component identity and can own the tooltip state (SidebarContent is
 * an inline component re-created on every layout render). The info control is
 * a sibling of the link, not a child: a button inside an anchor is invalid
 * markup and breaks keyboard focus.
 */
function PerformancePill({ performance }: { performance: PerformanceView | null }) {
  const [open, setOpen] = React.useState(false);

  if (performance === null) {
    return (
      <div className="px-3 py-2.5 border-b border-border">
        <Link href="/performance" className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl border border-border bg-secondary/40 text-xs transition-colors hover:bg-secondary">
          <Star className="h-3.5 w-3.5 text-muted-foreground" />
          <div className="flex-1 min-w-0">
            <span className="text-muted-foreground text-[11px] block">Performance score</span>
            <span className="text-xs font-medium text-foreground">Not enough data yet</span>
          </div>
        </Link>
      </div>
    );
  }

  const tone = scoreTone(performance.score);
  return (
    <div className="px-3 py-2.5 border-b border-border">
      <div
        className={cn("relative flex items-stretch rounded-xl border text-xs", tone.box)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        <Link href="/performance" className="flex flex-1 items-center gap-2.5 ps-2.5 py-2 rounded-s-xl transition-colors hover:brightness-105">
          <Star className={cn("h-3.5 w-3.5", tone.text)} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-[11px]">Performance score</span>
              <span className={cn("font-bold font-mono", tone.text)}>{performance.score}/100</span>
            </div>
            <div className="mt-1.5 h-1 bg-secondary rounded-full overflow-hidden">
              <div className={cn("h-full rounded-full transition-all", tone.fill)} style={{ width: `${performance.score}%` }} />
            </div>
          </div>
        </Link>
        <button
          type="button"
          aria-label="How the performance score is calculated"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          className="px-2 flex items-center text-muted-foreground hover:text-foreground rounded-e-xl transition-colors"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
        {open && (
          <div role="tooltip" className="absolute start-0 top-full mt-1.5 w-64 z-50 bg-popover text-popover-foreground border border-border rounded-xl shadow-elevated p-3 text-xs space-y-2">
            <p className="font-semibold">Orders from the last {performance.windowDays} days; listings and documents as they stand now</p>
            <ul className="space-y-1">
              {performance.components.map((component) => (
                <li key={component.key} className="flex items-start justify-between gap-2">
                  <span className="text-muted-foreground">
                    {component.label}
                    <span className="ms-1 text-[10px] font-mono">×{component.weight}</span>
                  </span>
                  <span className="font-mono shrink-0">
                    {component.share === null ? "no data" : `${component.good} of ${component.total}`}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground">
              Weights are re-scaled across the components that have data, so a component with none is left out rather than counted as zero.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export function SellerLayout({
  children,
  sellerName,
  tier,
  issueCount = 0,
  unreadMessages = 0,
  performance,
  permissions = [],
}: SellerLayoutProps) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState(false);

  React.useEffect(() => {
    try {
      const stored = localStorage.getItem("seller-sidebar-collapsed");
      if (stored === "true") setCollapsed(true);
    } catch {}
  }, []);

  function toggleCollapsed() {
    setCollapsed((v) => {
      const next = !v;
      try { localStorage.setItem("seller-sidebar-collapsed", String(next)); } catch {}
      return next;
    });
  }

  const can = (required: readonly string[]) => sellerNavigationAllows(permissions, required);

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-card border-e border-border">
      {/* Seller identity — only what the page actually knows about the seller */}
      <div className={cn("px-4 h-16 border-b border-border flex items-center gap-3", collapsed && "justify-center px-2")}>
        {sellerName && (
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary-500 to-accent-600 flex items-center justify-center shrink-0 font-black text-white">
            {sellerName.charAt(0).toUpperCase()}
          </div>
        )}
        {!collapsed && (sellerName || tier) && (
          <div className="min-w-0">
            {sellerName && <p className="font-bold text-sm leading-tight truncate">{sellerName}</p>}
            {tier && <span className="text-xs text-primary font-medium">{tier}</span>}
          </div>
        )}
      </div>

      {/* Performance score — hidden unless the page computed one */}
      {!collapsed && performance !== undefined && <PerformancePill performance={performance} />}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-3 scrollbar-hide">
        {NAV_GROUPS.map((group) => ({ ...group, items: group.items.filter((item) => can(item.permissions)) })).filter((group) => group.items.length > 0).map((group) => (
          <div key={group.label}>
            {!collapsed && (
              <p className="px-2 mb-1 text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-widest">{group.label}</p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                const badgeCount =
                  item.badge === "issues" ? issueCount :
                  item.badge === "messages" ? unreadMessages : 0;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      "flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-all group relative",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-glow-sm"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                      collapsed && "justify-center px-2"
                    )}
                  >
                    <item.icon className={cn("h-4 w-4 shrink-0", isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground")} />
                    {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                    {!collapsed && badgeCount > 0 && (
                      <span className="bg-danger text-white text-xs rounded-full h-4 min-w-4 px-1 flex items-center justify-center font-bold">
                        {badgeCount > 9 ? "9+" : badgeCount}
                      </span>
                    )}
                    {collapsed && badgeCount > 0 && (
                      <span className="absolute -top-1 -right-1 h-3 w-3 bg-danger rounded-full" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-border p-3 space-y-0.5">
        {can(["settings.manage"]) && <Link href="/settings" className={cn("flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors", collapsed && "justify-center")}>
          <Settings className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Settings</span>}
        </Link>}
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className={cn("w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors", collapsed && "justify-center")}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Sign out</span>}
        </button>
      </div>
    </div>
  );

  return (
    <ToastProvider>
      <CommandPalette />
      <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop sidebar */}
      <aside className={cn("hidden lg:flex flex-col shrink-0 transition-all duration-200", collapsed ? "w-14" : "w-56")}>
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="w-56 shrink-0"><SidebarContent /></div>
          <button type="button" className="flex-1 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} aria-label="Close menu" />
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="glass border-b border-border px-4 h-16 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button type="button" className="lg:hidden p-1.5 hover:bg-secondary rounded-lg transition-colors" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
              <Menu className="h-5 w-5 text-muted-foreground" />
            </button>
            <button type="button" className="hidden lg:flex p-1.5 hover:bg-secondary rounded-lg transition-colors" onClick={toggleCollapsed} aria-label="Toggle sidebar">
              <Menu className="h-5 w-5 text-muted-foreground" />
            </button>
            <span className="font-semibold text-sm hidden sm:block">Seller Central</span>
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event("open-command-palette"))}
              className="hidden md:flex items-center gap-2 h-9 ps-2.5 pe-2 ms-1 rounded-xl border border-border bg-secondary/40 text-muted-foreground hover:bg-secondary transition-colors text-sm"
            >
              <Search className="h-3.5 w-3.5" /> Search…
              <kbd className="ms-3 text-[10px] font-mono border border-border rounded px-1 py-0.5">⌘K</kbd>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <NotificationBell />
            <Link href="/messages" className="relative p-2 hover:bg-secondary rounded-lg transition-colors" aria-label="Messages">
              <MessageSquare className="h-5 w-5 text-muted-foreground" />
              {unreadMessages > 0 && (
                <span className="absolute top-1 right-1 h-4 min-w-4 px-1 bg-danger text-white text-[9px] rounded-full flex items-center justify-center font-bold">
                  {unreadMessages > 9 ? "9+" : unreadMessages}
                </span>
              )}
            </Link>
            <div className="relative group">
              <button type="button" className="flex items-center gap-2 p-1.5 hover:bg-secondary rounded-lg transition-colors" aria-label="Account menu">
                {sellerName ? (
                  <>
                    <div className="h-7 w-7 rounded-full bg-gradient-to-br from-primary-500 to-accent-600 flex items-center justify-center text-white font-bold text-xs">
                      {sellerName.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm font-medium hidden sm:block max-w-[100px] truncate">{sellerName}</span>
                  </>
                ) : (
                  <Settings className="h-4 w-4 text-muted-foreground" />
                )}
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              </button>
              <div className="absolute end-0 top-full mt-1.5 w-48 bg-popover text-popover-foreground border border-border rounded-xl shadow-elevated opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 p-1">
                {(sellerName || tier) && (
                  <div className="px-3 py-2.5 border-b border-border mb-1">
                    {sellerName && <p className="text-sm font-semibold truncate">{sellerName}</p>}
                    {tier && <span className="text-xs text-primary">{tier}</span>}
                  </div>
                )}
                <Link href="/performance" className="block px-3 py-2 text-sm rounded-lg hover:bg-secondary transition-colors">Performance</Link>
                <Link href="/settings" className="block px-3 py-2 text-sm rounded-lg hover:bg-secondary transition-colors">Settings</Link>
                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className="w-full text-start flex items-center gap-2 px-3 py-2 text-sm rounded-lg text-danger hover:bg-danger/10 transition-colors"
                >
                  <LogOut className="h-3.5 w-3.5" /> Sign out
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 bg-background">
          {children}
        </main>
      </div>
      </div>
    </ToastProvider>
  );
}
