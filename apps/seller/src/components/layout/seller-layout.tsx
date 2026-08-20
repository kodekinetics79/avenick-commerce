"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, TrendingUp,
  Package, Boxes, UploadCloud,
  ShoppingCart, Truck, RotateCcw,
  FileQuestion, Send, Clock,
  DollarSign, FileText, CreditCard,
  FolderOpen, CheckSquare,
  LifeBuoy, MessageSquare,
  Settings, Menu, ChevronDown, Star, LogOut, Search, BarChart3
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
      { href: "/issues", icon: UploadCloud, label: "Bulk Upload", badge: "issues", permissions: ["catalog.view", "catalog.manage"] },
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
      { href: "/messages", icon: FileQuestion, label: "RFQ Inbox", badge: "messages", permissions: ["rfqs.view"] },
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
      { href: "/onboarding", icon: CheckSquare, label: "Onboarding", permissions: ["documents.view", "documents.manage"] },
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

interface SellerLayoutProps {
  children: React.ReactNode;
  sellerName?: string;
  tier?: string;
  issueCount?: number;
  unreadMessages?: number;
  performanceScore?: number;
  permissions?: readonly string[];
}

export function SellerLayout({
  children,
  sellerName = "My Store",
  tier = "VERIFIED",
  issueCount = 0,
  unreadMessages = 0,
  performanceScore = 87,
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

  const scoreColor = performanceScore >= 80 ? "text-success" : performanceScore >= 60 ? "text-warning" : "text-danger";
  const scoreBg = performanceScore >= 80 ? "bg-success/10 border-success/30" : performanceScore >= 60 ? "bg-warning/10 border-warning/30" : "bg-danger/10 border-danger/30";
  const scoreFill = performanceScore >= 80 ? "bg-success" : performanceScore >= 60 ? "bg-warning" : "bg-danger";
  const can = (required: readonly string[]) => sellerNavigationAllows(permissions, required);

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-card border-e border-border">
      {/* Logo / Branding */}
      <div className={cn("px-4 h-16 border-b border-border flex items-center gap-3", collapsed && "justify-center px-2")}>
        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary-500 to-accent-600 flex items-center justify-center shrink-0 font-black text-white">
          {sellerName.charAt(0).toUpperCase()}
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="font-bold text-sm leading-tight truncate">{sellerName}</p>
            <span className="text-xs text-primary font-medium">{tier}</span>
          </div>
        )}
      </div>

      {/* Performance Score Pill */}
      {!collapsed && (
        <div className="px-3 py-2.5 border-b border-border">
          <Link href="/performance" className={cn("flex items-center gap-2.5 px-2.5 py-2 rounded-xl border text-xs transition-colors hover:brightness-105", scoreBg)}>
            <Star className={cn("h-3.5 w-3.5", scoreColor)} />
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-[11px]">Performance score</span>
                <span className={cn("font-bold font-mono", scoreColor)}>{performanceScore}/100</span>
              </div>
              <div className="mt-1.5 h-1 bg-secondary rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    scoreFill,
                    performanceScore >= 90 ? "w-[90%]" : performanceScore >= 80 ? "w-[80%]" : performanceScore >= 70 ? "w-[70%]" : performanceScore >= 60 ? "w-[60%]" : "w-[50%]"
                  )}
                />
              </div>
            </div>
          </Link>
        </div>
      )}

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
      <CommandPalette permissions={permissions} />
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
              <button type="button" className="flex items-center gap-2 p-1.5 hover:bg-secondary rounded-lg transition-colors">
                <div className="h-7 w-7 rounded-full bg-gradient-to-br from-primary-500 to-accent-600 flex items-center justify-center text-white font-bold text-xs">
                  {sellerName.charAt(0).toUpperCase()}
                </div>
                <span className="text-sm font-medium hidden sm:block max-w-[100px] truncate">{sellerName}</span>
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              </button>
              <div className="absolute end-0 top-full mt-1.5 w-48 bg-popover text-popover-foreground border border-border rounded-xl shadow-elevated opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 p-1">
                <div className="px-3 py-2.5 border-b border-border mb-1">
                  <p className="text-sm font-semibold truncate">{sellerName}</p>
                  <span className="text-xs text-primary">{tier}</span>
                </div>
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
