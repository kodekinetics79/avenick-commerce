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
  Settings, Bell, Menu, ChevronDown, Star, LogOut
} from "lucide-react";
import { cn } from "@avenick/utils";
import { ThemeToggle } from "@avenick/ui";

const NAV_GROUPS = [
  {
    label: "Overview",
    items: [
      { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
      { href: "/performance", icon: TrendingUp, label: "Performance" },
    ],
  },
  {
    label: "Catalog",
    items: [
      { href: "/products", icon: Package, label: "Products" },
      { href: "/inventory", icon: Boxes, label: "Inventory" },
      { href: "/issues", icon: UploadCloud, label: "Bulk Upload", badge: "issues" },
    ],
  },
  {
    label: "Orders",
    items: [
      { href: "/orders", icon: ShoppingCart, label: "Orders" },
      { href: "/shipments", icon: Truck, label: "Shipments" },
      { href: "/returns", icon: RotateCcw, label: "Returns" },
    ],
  },
  {
    label: "RFQ / Quotes",
    items: [
      { href: "/messages", icon: FileQuestion, label: "RFQ Inbox", badge: "messages" },
      { href: "/quotes/submit", icon: Send, label: "Submit Quote" },
      { href: "/quotes", icon: Clock, label: "Quote History" },
    ],
  },
  {
    label: "Finance",
    items: [
      { href: "/payouts", icon: DollarSign, label: "Payouts" },
      { href: "/invoices", icon: FileText, label: "Invoices" },
      { href: "/commission", icon: CreditCard, label: "Commission" },
    ],
  },
  {
    label: "Documents",
    items: [
      { href: "/documents", icon: FolderOpen, label: "Document Center" },
      { href: "/compliance", icon: CheckSquare, label: "Onboarding" },
    ],
  },
  {
    label: "Support",
    items: [
      { href: "/issues", icon: LifeBuoy, label: "Tickets" },
      { href: "/messages", icon: MessageSquare, label: "Contact Admin" },
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
}

export function SellerLayout({
  children,
  sellerName = "My Store",
  tier = "VERIFIED",
  issueCount = 0,
  unreadMessages = 0,
  performanceScore = 87,
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
        {NAV_GROUPS.map((group) => (
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
        <Link href="/settings" className={cn("flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors", collapsed && "justify-center")}>
          <Settings className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Settings</span>}
        </Link>
        <Link href="/api/auth/signout" className={cn("flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors", collapsed && "justify-center")}>
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
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/messages" className="relative p-2 hover:bg-secondary rounded-lg transition-colors" aria-label="Messages">
              <Bell className="h-5 w-5 text-muted-foreground" />
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
                <Link href="/api/auth/signout" className="block px-3 py-2 text-sm rounded-lg text-danger hover:bg-danger/10 transition-colors">Sign out</Link>
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
  );
}
