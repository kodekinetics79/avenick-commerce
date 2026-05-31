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
  Menu, Search, Bell, ChevronDown, Zap, LogOut, Coins
} from "lucide-react";
import { cn } from "@avenick/utils";
import { ThemeToggle } from "@avenick/ui";

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

export function AdminLayout({ children, pendingCount = 0 }: { children: React.ReactNode; pendingCount?: number }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);

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
                const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"));
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
        <Link
          href="/api/auth/signout"
          className={cn("flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors", collapsed && "justify-center")}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Sign out</span>}
        </Link>
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

            <div className="hidden sm:flex items-center gap-2 bg-secondary/60 border border-border rounded-xl px-3 h-9 w-64">
              <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <input type="text" placeholder="Search admin…" className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none flex-1 min-w-0" />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full">STAGING</span>
            <ThemeToggle />
            <button type="button" className="relative p-2 hover:bg-secondary rounded-lg transition-colors" aria-label="Notifications">
              <Bell className="h-5 w-5 text-muted-foreground" />
              {pendingCount > 0 && (
                <span className="absolute top-1 right-1 h-4 min-w-4 px-1 bg-danger text-white text-[9px] rounded-full flex items-center justify-center font-bold">
                  {pendingCount > 9 ? "9+" : pendingCount}
                </span>
              )}
            </button>
            <div className="relative group">
              <button type="button" className="flex items-center gap-2 p-1.5 hover:bg-secondary rounded-lg transition-colors">
                <div className="h-7 w-7 rounded-full bg-gradient-to-br from-primary-500 to-accent-600 flex items-center justify-center text-white font-bold text-xs">A</div>
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              </button>
              <div className="absolute end-0 top-full mt-1.5 w-48 bg-popover text-popover-foreground border border-border rounded-xl shadow-elevated opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 p-1">
                <div className="px-3 py-2.5 border-b border-border mb-1">
                  <p className="text-sm font-semibold">Admin User</p>
                  <p className="text-xs text-muted-foreground">admin@avenick.com</p>
                </div>
                <Link href="/settings" className="block px-3 py-2 text-sm rounded-lg hover:bg-secondary transition-colors">Settings</Link>
                <Link href="/api/auth/signout" className="block px-3 py-2 text-sm rounded-lg text-danger hover:bg-danger/10 transition-colors">Sign out</Link>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 bg-background">{children}</main>
      </div>
    </div>
  );
}
