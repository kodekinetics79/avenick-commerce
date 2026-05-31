"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, FileQuestion, FileCheck2, ClipboardList, CheckSquare,
  ListChecks, Receipt, BarChart3, Users, Building2, Plus,
} from "lucide-react";
import { cn } from "@avenick/utils";
import { MainLayout } from "@/components/layout/main-layout";

const NAV = [
  { href: "/b2b", label: "Overview", icon: LayoutDashboard },
  { href: "/b2b/purchase-orders", label: "Purchase Orders", icon: FileCheck2 },
  { href: "/b2b/rfq/new", label: "New RFQ", icon: FileQuestion },
  { href: "/b2b/quotes", label: "Quotes", icon: ClipboardList },
  { href: "/b2b/approvals", label: "Approvals", icon: CheckSquare },
  { href: "/b2b/lists", label: "Requisition Lists", icon: ListChecks },
  { href: "/b2b/billing", label: "Billing & Invoices", icon: Receipt },
  { href: "/b2b/analytics", label: "Spend Analytics", icon: BarChart3 },
  { href: "/b2b/team", label: "Team & Roles", icon: Users },
  { href: "/b2b/company", label: "Company", icon: Building2 },
];

export function B2BShell({
  children,
  title,
  description,
  actions,
}: {
  children: React.ReactNode;
  title?: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/b2b" ? pathname === "/b2b" : pathname === href || pathname.startsWith(href + "/") || pathname.startsWith(href.replace("/new", ""));

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto px-4 py-6 lg:py-8">
        {/* Portal banner */}
        <div className="relative overflow-hidden rounded-2xl border border-border bg-card mb-6">
          <div className="absolute inset-0 bg-grid opacity-50" />
          <div className="absolute -top-12 end-8 h-40 w-40 rounded-full bg-primary/15 blur-[80px]" />
          <div className="relative px-5 py-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-primary-500 to-accent-600 text-white shrink-0">
                <Building2 className="h-4.5 w-4.5" />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-primary">Business Portal</p>
                <p className="text-sm font-bold truncate">Avenick for Business</p>
              </div>
            </div>
            <Link href="/b2b/rfq/new" className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 hover:shadow-glow-sm transition-all active:scale-[0.98]">
              <Plus className="h-3.5 w-3.5" /> New RFQ
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6">
          {/* Sidebar nav */}
          <aside className="lg:sticky lg:top-24 h-max">
            <nav className="flex lg:flex-col gap-1 overflow-x-auto scrollbar-hide pb-1">
              {NAV.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors shrink-0",
                    isActive(href)
                      ? "bg-primary text-primary-foreground shadow-glow-sm"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </Link>
              ))}
            </nav>
          </aside>

          {/* Content */}
          <div className="min-w-0">
            {(title || actions) && (
              <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
                <div>
                  {title && <h1 className="text-2xl font-bold tracking-tight">{title}</h1>}
                  {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
                </div>
                {actions}
              </div>
            )}
            {children}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
