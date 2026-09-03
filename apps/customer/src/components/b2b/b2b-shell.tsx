"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, FileCheck2, ClipboardList, CheckSquare,
  ListChecks, Receipt, BarChart3, Users, Building2, Plus, ShieldCheck, MapPin,
} from "lucide-react";
import { Button, Eyebrow, NavItem, PageHeader, Surface } from "@avenick/ui";
import { platformName } from "@avenick/utils/portal-config";
import { MainLayout } from "@/components/layout/main-layout";

/*
 * The sidebar is grouped rather than a flat list of twelve.
 *
 * A procurement manager does three different jobs in here, and they have
 * different tempos: clearing today's queue, reading the money, and changing the
 * rules. Twelve equally-weighted rows made all three look like the same job.
 *
 * "New RFQ" has left the list on purpose: it is an ACTION, not a place, and it
 * now sits as the portal's single persistent call to action above the nav.
 *
 * This file is a registered navigation source in
 * ops/release/frontend-availability.json — every href below must have an
 * availability contract there, and CI fails the build otherwise.
 */
const NAV_GROUPS: Array<{ label: string; items: Array<{ href: string; label: string; icon: typeof Building2 }> }> = [
  {
    label: "Working",
    items: [
      { href: "/b2b", label: "Overview", icon: LayoutDashboard },
      { href: "/b2b/approvals", label: "Approvals", icon: CheckSquare },
      { href: "/b2b/quotes", label: "Quotes", icon: ClipboardList },
      { href: "/b2b/purchase-orders", label: "Purchase Orders", icon: FileCheck2 },
      { href: "/b2b/lists", label: "Requisition Lists", icon: ListChecks },
    ],
  },
  {
    label: "Money",
    items: [
      { href: "/b2b/billing", label: "Billing & Invoices", icon: Receipt },
      { href: "/b2b/analytics", label: "Spend Analytics", icon: BarChart3 },
    ],
  },
  {
    label: "Administration",
    items: [
      { href: "/b2b/approval-policies", label: "Approval Policies", icon: ShieldCheck },
      { href: "/b2b/team", label: "Team & Roles", icon: Users },
      { href: "/b2b/addresses", label: "Delivery Sites", icon: MapPin },
      { href: "/b2b/company", label: "Company", icon: Building2 },
    ],
  },
];

export function B2BShell({
  children,
  title,
  description,
  eyebrow,
  dateline,
  actions,
}: {
  children: React.ReactNode;
  title?: string;
  description?: string;
  /** Micro-caps label above the title, e.g. the section this page belongs to. */
  eyebrow?: string;
  /** Provenance for the whole page — what this data is, over what window. */
  dateline?: string;
  actions?: React.ReactNode;
}) {
  const pathname = usePathname();
  // An RFQ lives under /b2b/rfq/… but the buyer arrives at it from Quotes, and
  // the detail page's own back link points there, so Quotes is the section that
  // stays lit rather than nothing at all.
  const section = pathname.startsWith("/b2b/rfq") ? "/b2b/quotes" : pathname;
  const isActive = (href: string) =>
    href === "/b2b" ? section === "/b2b" : section === href || section.startsWith(href + "/");

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto px-4 py-6 lg:py-8">
        {/* The portal strip. Recessed, because it is CONTEXT — it says which
            workspace you are in — while the one action raised on top of it is
            the workspace's single persistent call to action. The orb, the grid
            wash and the indigo→verdigris gradient tile that used to live here
            carried no information and are gone. */}
        <Surface rung={1} className="mb-6 flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <Eyebrow>Business portal</Eyebrow>
            <p className="u-ui truncate font-medium text-ink-1">{platformName()} for Business</p>
          </div>
          <Button asChild variant="primary" size="sm" className="shrink-0">
            <Link href="/b2b/rfq/new">
              <Plus className="h-3.5 w-3.5" aria-hidden="true" /> New RFQ
            </Link>
          </Button>
        </Surface>

        <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6">
          {/* Sidebar nav. The active item is RAISED with a brass rule at its
              inline start rather than filled with indigo, which is the same
              mark the seller and admin sidebars carry — one platform, three
              postures. */}
          <aside className="lg:sticky lg:top-24 h-max">
            <nav
              aria-label="Business portal"
              className="flex gap-5 overflow-x-auto scrollbar-hide pb-1 lg:flex-col lg:gap-5 lg:overflow-visible"
            >
              {NAV_GROUPS.map((group) => (
                <div key={group.label} className="flex shrink-0 gap-1 lg:flex-col lg:gap-0.5">
                  <Eyebrow className="hidden lg:block lg:mb-1.5 lg:ps-3">{group.label}</Eyebrow>
                  {group.items.map(({ href, label, icon }) => (
                    <NavItem
                      key={href}
                      href={href}
                      label={label}
                      icon={icon}
                      active={isActive(href)}
                      linkComponent={Link}
                      className="shrink-0 whitespace-nowrap"
                    />
                  ))}
                </div>
              ))}
            </nav>
          </aside>

          {/* Content */}
          <div className="min-w-0">
            {/* Only when there is a title: an actions-only header would render
                an empty <h1>, which reads as a missing heading to a screen
                reader rather than as no heading at all. */}
            {title && (
              <PageHeader
                title={title}
                description={description}
                eyebrow={eyebrow}
                dateline={dateline}
                actions={actions}
                linkComponent={Link}
              />
            )}
            {children}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
