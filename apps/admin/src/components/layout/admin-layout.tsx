"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Brain, Package, Tag, Award, Percent,
  Building2, FileQuestion, Quote, CheckSquare, Store, Clock, FileCheck, TrendingUp,
  ShoppingCart, Ship, RotateCcw, Send, Warehouse, ArrowDownToLine, Boxes, PackageCheck,
  Users, Megaphone, PieChart, Heart, DollarSign, CreditCard, Receipt, FileSpreadsheet,
  LifeBuoy, Scale, Gauge, Settings, UserCog, Plug, ScrollText,
  Menu, Search, Bell, ChevronDown, Zap, LogOut, Coins, FileUp
} from "lucide-react";
import { cn } from "@avenick/utils";
import { ThemeToggle } from "@avenick/ui";
import { signOut, useSession } from "next-auth/react";
import { CommandPalette } from "@/components/command-palette";

const NAV_GROUPS = [
  {
    label: "Command Center",
    items: [
      { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
      { href: "/ai-insights", icon: Brain, label: "AI Insights" },
      { href: "/automation", icon: Zap, label: "Automation" },
    ],
  },
  {
    label: "Commerce",
    items: [
      { href: "/products", icon: Package, label: "Products" },
      { href: "/catalog-import", icon: FileUp, label: "Catalog Import" },
      { href: "/categories", icon: Tag, label: "Categories" },
      { href: "/brands", icon: Award, label: "Brands" },
      { href: "/deals", icon: Percent, label: "Deals" },
      { href: "/pricing", icon: Coins, label: "Pricing & Commission" },
    ],
  },
  {
    label: "B2B Trade",
    items: [
      { href: "/companies", icon: Building2, label: "Companies" },
      { href: "/rfqs", icon: FileQuestion, label: "RFQs" },
      { href: "/quotes", icon: Quote, label: "Quotes" },
      { href: "/approvals", icon: CheckSquare, label: "Approvals" },
    ],
  },
  {
    label: "Supplier Network",
    items: [
      { href: "/sellers", icon: Store, label: "All Suppliers" },
      { href: "/sellers/pending", icon: Clock, label: "Pending", badge: "pending" },
      { href: "/compliance", icon: FileCheck, label: "Documents" },
      { href: "/performance", icon: TrendingUp, label: "Performance" },
    ],
  },
  {
    label: "Orders",
    items: [
      { href: "/orders", icon: ShoppingCart, label: "All Orders" },
      { href: "/shipments", icon: Ship, label: "Shipments" },
      { href: "/returns", icon: RotateCcw, label: "Returns" },
      { href: "/warehouse/pickpack?tab=dispatch", icon: Send, label: "Dispatch" },
    ],
  },
  {
    label: "Warehouse",
    items: [
      { href: "/warehouse", icon: Warehouse, label: "Overview" },
      { href: "/warehouse/inbound", icon: ArrowDownToLine, label: "Inbound" },
      { href: "/warehouse/stock", icon: Boxes, label: "Stock" },
      { href: "/warehouse/pickpack", icon: PackageCheck, label: "Pick/Pack" },
    ],
  },
  {
    label: "CRM",
    items: [
      { href: "/crm", icon: Users, label: "Accounts" },
      { href: "/campaigns", icon: Megaphone, label: "Campaigns" },
      { href: "/segments", icon: PieChart, label: "Segments" },
      { href: "/retention", icon: Heart, label: "Retention" },
    ],
  },
  {
    label: "Finance",
    items: [
      { href: "/finance", icon: DollarSign, label: "Invoices" },
      { href: "/payments", icon: CreditCard, label: "Payments" },
      { href: "/settlements", icon: Receipt, label: "Settlements" },
      { href: "/vat", icon: FileSpreadsheet, label: "VAT" },
    ],
  },
  {
    label: "Support",
    items: [
      { href: "/support", icon: LifeBuoy, label: "Tickets" },
      { href: "/disputes", icon: Scale, label: "Disputes" },
      { href: "/sla", icon: Gauge, label: "SLA Monitor" },
    ],
  },
  {
    label: "Settings",
    items: [
      { href: "/users", icon: UserCog, label: "Users" },
      { href: "/integrations", icon: Plug, label: "Integrations" },
      { href: "/audit", icon: ScrollText, label: "Audit Trail" },
      { href: "/settings", icon: Settings, label: "Settings" },
    ],
  },
];

/** Initial for the avatar: first letter of the real name, else of the email. */
function avatarInitial(name: string | null | undefined, email: string | null | undefined): string {
  const source = name?.trim() || email?.trim() || "";
  return source ? source.charAt(0).toUpperCase() : "";
}

export function AdminLayout({ children, pendingCount = 0 }: { children: React.ReactNode; pendingCount?: number }) {
  const pathname = usePathname();
  const { data: session, status: sessionStatus } = useSession();
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [profileOpen, setProfileOpen] = React.useState(false);
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const [shortcutHint, setShortcutHint] = React.useState("");
  const profileRef = React.useRef<HTMLDivElement>(null);

  // The shortcut label depends on the visitor's platform, which is only known
  // in the browser; rendering it after mount avoids a hydration mismatch.
  React.useEffect(() => {
    const isMac = /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent);
    setShortcutHint(isMac ? "⌘K" : "Ctrl K");
  }, []);

  const user = sessionStatus === "authenticated" ? session?.user : null;
  const initial = avatarInitial(user?.name, user?.email);

  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  React.useEffect(() => {
    try {
      const stored = localStorage.getItem("admin-sidebar-collapsed");
      if (stored === "true") setCollapsed(true);
    } catch {}
  }, []);

  function toggleCollapsed() {
    setCollapsed((v) => {
      const next = !v;
      try { localStorage.setItem("admin-sidebar-collapsed", String(next)); } catch {}
      return next;
    });
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-card border-e border-border">
      {/* Logo area */}
      <div className={cn("px-4 h-16 border-b border-border flex items-center gap-3", collapsed && "justify-center px-2")}>
        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary-500 to-accent-600 flex items-center justify-center shrink-0 shadow-glow-sm">
          <span className="text-white font-black text-base">A</span>
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="font-extrabold text-sm leading-tight truncate tracking-tight">avenick</p>
            <p className="text-muted-foreground text-[11px] font-medium tracking-wide">Admin Console</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4 scrollbar-hide">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            {!collapsed && (
              <p className="px-2 mb-1 text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-widest">{group.label}</p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isExact = pathname === item.href;
                const isChild = item.href !== "/dashboard" && item.href !== "/sellers" && item.href !== "/sellers/pending" && pathname.startsWith(item.href + "/");
                const isActive = isExact || isChild;
                const badgeNum = item.badge === "pending" ? pendingCount : 0;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
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
                    {!collapsed && <span className="truncate flex-1">{item.label}</span>}
                    {!collapsed && badgeNum > 0 && (
                      <span className="ms-auto bg-danger text-white text-xs rounded-full h-4 min-w-4 px-1 flex items-center justify-center font-bold">
                        {badgeNum > 9 ? "9+" : badgeNum}
                      </span>
                    )}
                    {collapsed && badgeNum > 0 && (
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
      <div className="border-t border-border p-3">
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className={cn("flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors w-full", collapsed && "justify-center")}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Sign out</span>}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop sidebar */}
      <aside className={cn("hidden lg:flex flex-col shrink-0 transition-all duration-200", collapsed ? "w-14" : "w-56")}>
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="w-56 shrink-0"><SidebarContent /></div>
          <button type="button" className="flex-1 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} aria-label="Close menu" />
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top header */}
        <header className="glass border-b border-border h-16 px-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button type="button" className="lg:hidden p-1.5 hover:bg-secondary rounded-lg transition-colors" onClick={() => setMobileOpen(true)} aria-label="Open menu">
              <Menu className="h-5 w-5 text-muted-foreground" />
            </button>
            <button type="button" className="hidden lg:flex p-1.5 hover:bg-secondary rounded-lg transition-colors" onClick={toggleCollapsed} aria-label="Toggle sidebar">
              <Menu className="h-5 w-5 text-muted-foreground" />
            </button>

            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="hidden sm:flex items-center gap-2 bg-secondary/60 border border-border rounded-xl px-3 h-9 w-64 text-start hover:bg-secondary transition-colors"
              aria-haspopup="dialog"
              aria-expanded={paletteOpen}
            >
              <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-sm text-muted-foreground flex-1 min-w-0 truncate">Jump to page…</span>
              {shortcutHint && <kbd className="text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5">{shortcutHint}</kbd>}
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Only a build that is not a production build gets a badge; a
                production build must not claim to be anything else. */}
            {process.env.NODE_ENV !== "production" && (
              <span className="text-[10px] font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full">DEV BUILD</span>
            )}
            <ThemeToggle />
            <button type="button" className="relative p-2 hover:bg-secondary rounded-lg transition-colors" aria-label="Notifications">
              <Bell className="h-5 w-5 text-muted-foreground" />
              {pendingCount > 0 && (
                <span className="absolute top-1 right-1 h-4 min-w-4 px-1 bg-danger text-white text-[9px] rounded-full flex items-center justify-center font-bold">
                  {pendingCount > 9 ? "9+" : pendingCount}
                </span>
              )}
            </button>
            <div className="relative" ref={profileRef}>
              <button type="button" onClick={() => setProfileOpen(v => !v)} className="flex items-center gap-2 p-1.5 hover:bg-secondary rounded-lg transition-colors" aria-label="Account menu">
                {/* Blank while the session is loading: a placeholder letter would be a made-up identity. */}
                <div className="h-7 w-7 rounded-full bg-gradient-to-br from-primary-500 to-accent-600 flex items-center justify-center text-white font-bold text-xs" aria-hidden="true">{initial}</div>
                <ChevronDown className={cn("h-3 w-3 text-muted-foreground transition-transform", profileOpen && "rotate-180")} />
              </button>
              {profileOpen && (
                <div className="absolute end-0 top-full mt-1.5 w-56 bg-popover text-popover-foreground border border-border rounded-xl shadow-elevated z-50 p-1">
                  {sessionStatus === "loading" ? (
                    <div className="px-3 py-2.5 border-b border-border mb-1" aria-busy="true">
                      <div className="h-3.5 w-24 rounded bg-muted animate-pulse mb-1.5" />
                      <div className="h-3 w-36 rounded bg-muted animate-pulse" />
                    </div>
                  ) : user ? (
                    <div className="px-3 py-2.5 border-b border-border mb-1 min-w-0">
                      {user.name?.trim() && <p className="text-sm font-semibold truncate">{user.name}</p>}
                      {user.email && <p className="text-xs text-muted-foreground truncate">{user.email}</p>}
                    </div>
                  ) : (
                    <div className="px-3 py-2.5 border-b border-border mb-1">
                      <p className="text-xs text-muted-foreground">Signed-in identity unavailable</p>
                    </div>
                  )}
                  <Link href="/settings" onClick={() => setProfileOpen(false)} className="block px-3 py-2 text-sm rounded-lg hover:bg-secondary transition-colors">Settings</Link>
                  <button type="button" onClick={() => signOut({ callbackUrl: "/login" })} className="w-full text-start px-3 py-2 text-sm rounded-lg text-danger hover:bg-danger/10 transition-colors">Sign out</button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 bg-background">{children}</main>
      </div>

      <CommandPalette groups={NAV_GROUPS} open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}
