"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  LayoutDashboard, FileCheck2, ClipboardList, CheckSquare,
  ListChecks, Receipt, BarChart3, Users, Building2, Plus, ShieldCheck, MapPin, Eye,
} from "lucide-react";
import { Button, Eyebrow, NavItem, PageHeader, Surface } from "@avenick/ui";
import { platformName } from "@avenick/utils/portal-config";
import { MainLayout } from "@/components/layout/main-layout";
import { useB2BT } from "./use-b2b-t";
import { navAccessForRole } from "./nav-access";
import type { B2BKey } from "./messages";

/*
 * The sidebar is grouped rather than a flat list of twelve.
 *
 * A procurement manager does three different jobs in here, and they have
 * different tempos: clearing today's queue, reading the money, and changing the
 * rules. Twelve equally-weighted rows made all three look like the same job.
 *
 * "New RFQ" has left the list on purpose: it is an ACTION, not a place, and it
 * now sits as the portal's single persistent call to action in the masthead.
 *
 * Labels are message KEYS, not English. This file used to hold fourteen literal
 * strings, which is why the Arabic build shipped an English sidebar.
 *
 * This file is a registered navigation source in
 * ops/release/frontend-availability.json — every href below must have an
 * availability contract there, and CI fails the build otherwise. That is also
 * why the hrefs stay in THIS file rather than moving out with the role policy:
 * the registry names this path, and a nav whose destinations had moved would
 * pass that check by having nothing left to check.
 *
 * WHAT EACH ROW MEANS FOR THE READER is decided by ./nav-access.ts, which
 * describes the server's own gates. Until then every role saw the same eleven
 * rows, so a buyer read Team, Approval Policies and Delivery Sites as places
 * they could work and found out otherwise on arrival.
 */
const NAV_GROUPS: Array<{ label: B2BKey; items: Array<{ href: string; label: B2BKey; icon: typeof Building2 }> }> = [
  {
    label: "nav.group.working",
    items: [
      { href: "/b2b", label: "nav.overview", icon: LayoutDashboard },
      { href: "/b2b/approvals", label: "nav.approvals", icon: CheckSquare },
      { href: "/b2b/quotes", label: "nav.quotes", icon: ClipboardList },
      { href: "/b2b/purchase-orders", label: "nav.purchaseOrders", icon: FileCheck2 },
      { href: "/b2b/lists", label: "nav.lists", icon: ListChecks },
    ],
  },
  {
    label: "nav.group.money",
    items: [
      { href: "/b2b/billing", label: "nav.billing", icon: Receipt },
      { href: "/b2b/analytics", label: "nav.analytics", icon: BarChart3 },
    ],
  },
  {
    label: "nav.group.administration",
    items: [
      { href: "/b2b/approval-policies", label: "nav.policies", icon: ShieldCheck },
      { href: "/b2b/team", label: "nav.team", icon: Users },
      { href: "/b2b/addresses", label: "nav.addresses", icon: MapPin },
      { href: "/b2b/company", label: "nav.company", icon: Building2 },
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
  workspace,
  role,
}: {
  children: React.ReactNode;
  title?: string;
  description?: string;
  /** Micro-caps label above the title, e.g. the section this page belongs to. */
  eyebrow?: string;
  /** Provenance for the whole page — what this data is, over what window. */
  dateline?: string;
  actions?: React.ReactNode;
  /**
   * The name of the company whose books are open. Pages that have already
   * loaded a company context pass it; the rest fall back to the platform line.
   * Naming the company in the masthead is the cheapest possible answer to
   * "whose purchase orders am I looking at" on a shared machine.
   */
  workspace?: string;
  /**
   * The reader's CompanyMember role, when the page already holds it.
   *
   * A page that has resolved a B2B context knows the company's own record of
   * this person's authority and should pass it; every other page falls back to
   * the role on the session below. The two cannot disagree for anyone who can
   * see this shell at all — isDurableB2BMember (lib/b2b-access.ts:19) refuses a
   * membership whose User.role and CompanyMember.role have diverged — but the
   * company record is the governance record, so where it is in hand it wins.
   */
  role?: string;
}) {
  const t = useB2BT();
  const pathname = usePathname();
  // The sidebar has to be able to describe authority on ELEVEN pages, only one
  // of which passes a role, so the fallback is the session — the same role the
  // JWT callback copies off the User row (packages/auth/src/config.ts:88-89).
  // It is cast because this repo carries no next-auth module augmentation, so
  // `session.user` is typed as the library's bare default; an absent or
  // unexpected value is handled by navAccessForRole rather than asserted away.
  const { data: session } = useSession();
  const viewerRole = role ?? (session?.user as { role?: string } | undefined)?.role;
  // An RFQ lives under /b2b/rfq/… but the buyer arrives at it from Quotes, and
  // the detail page's own back link points there, so Quotes is the section that
  // stays lit rather than nothing at all.
  const section = pathname.startsWith("/b2b/rfq") ? "/b2b/quotes" : pathname;
  const isActive = (href: string) =>
    href === "/b2b" ? section === "/b2b" : section === href || section.startsWith(href + "/");

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto px-4 py-6 lg:py-8">
        {/* ── The masthead ────────────────────────────────────────────────────
            Recessed, because it is CONTEXT — it says whose register you have
            open — while the one action raised on top of it is the workspace's
            single persistent call to action.

            The brass rule across its top edge is the SAME `.u-drawn` gesture as
            active nav, the currency ledger's head and the certificate's top
            edge. One gesture in several postures is what makes the system read
            as designed rather than assembled; a fifth mark with its own timing
            curve is how that stops being true. */}
        <Surface rung={1} className="mb-6 overflow-hidden">
          <div className="u-drawn w-14" data-on="true" aria-hidden="true" />
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <Eyebrow>{t("shell.workspace")}</Eyebrow>
              <p className="u-h3 truncate text-ink-1">
                {workspace ?? t("shell.forBusiness", { platform: platformName() })}
              </p>
            </div>
            <Button asChild variant="primary" size="sm" className="shrink-0">
              <Link href="/b2b/rfq/new" aria-label={t("shell.newRfqFull")}>
                <Plus className="h-3.5 w-3.5" aria-hidden="true" /> {t("shell.newRfq")}
              </Link>
            </Button>
          </div>
        </Surface>

        <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6">
          {/* Sidebar nav. The active item is RAISED with a brass rule at its
              inline start rather than filled with indigo, which is the same
              mark the seller and admin sidebars carry — one platform, three
              postures. */}
          <aside className="lg:sticky lg:top-24 h-max">
            <nav
              aria-label={t("shell.nav")}
              // Below lg this is a horizontal scroller, so it gets the SYMMETRIC
              // inline edge mask: a one-sided `to right` fade passes English
              // review and ships broken in Arabic. Above lg the mask is removed
              // outright rather than made wider, because a 220px column with
              // feathered inline edges fades the nav labels themselves.
              // Above lg the fade is switched off by taking --edge to 0, not by
              // overriding mask-image: a mask with zero-width edges is opaque
              // everywhere, it needs no vendor-prefixed second override, and it
              // keeps the whole behaviour in one token. A 220px column with
              // feathered inline edges would fade the nav labels themselves.
              className="u-edge-fade-inline flex gap-5 overflow-x-auto pb-1 [--edge:18px] lg:[--edge:0px] lg:flex-col lg:gap-5 lg:overflow-visible"
            >
              {NAV_GROUPS.map((group) => {
                // A group whose every destination is hidden for this role must
                // not leave its heading behind over nothing.
                const items = group.items.filter(
                  ({ href }) => navAccessForRole(href, viewerRole) !== "hidden",
                );
                if (items.length === 0) return null;
                return (
                <div key={group.label} className="flex shrink-0 gap-1 lg:flex-col lg:gap-0.5">
                  <Eyebrow className="hidden lg:block lg:mb-1.5 lg:ps-3">{t(group.label)}</Eyebrow>
                  {items.map(({ href, label, icon }) => (
                    <NavItem
                      key={href}
                      href={href}
                      label={t(label)}
                      icon={icon}
                      active={isActive(href)}
                      linkComponent={Link}
                      className="shrink-0 whitespace-nowrap"
                      // A destination this role may read but not change says so
                      // BEFORE the click. The eye is aria-hidden and the words
                      // are the accessible text, so the link is announced as
                      // "Team & Roles, view only" rather than as an unexplained
                      // icon — the badge sits inside the anchor, so it becomes
                      // part of the link's name.
                      badge={
                        navAccessForRole(href, viewerRole) === "read" ? (
                          <span className="inline-flex items-center" title={t("nav.viewOnly")}>
                            <Eye className="h-3 w-3" aria-hidden="true" />
                            <span className="sr-only">{t("nav.viewOnly")}</span>
                          </span>
                        ) : undefined
                      }
                    />
                  ))}
                </div>
                );
              })}
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
