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
  PanelLeft, Search, ChevronDown, Zap, LogOut, Coins, FileUp
} from "lucide-react";
import { cn } from "@avenick/utils";
import { platformName } from "@avenick/utils/portal-config";
import { Eyebrow, NavItem, StatusPill, Surface, ThemeToggle } from "@avenick/ui";
import { signOut, useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { CommandPalette, type PaletteGroup } from "@/components/command-palette";

/**
 * Availability of the screens this navigation points at, mirrored from
 * ops/release/frontend-availability.json — the registry CI validates every href
 * below against. Only the non-operational screens are listed; anything absent is
 * operational.
 *
 * This is here because an operator should not have to click a screen to find out
 * that it is showing static example data. The sidebar shows a mark only for the
 * two states where the DATA is not real (`simulated`, `unavailable`), because
 * marking sixteen read-only screens in the persistent chrome would be noise that
 * hides the two that matter. The command palette, which is a lookup surface
 * rather than chrome, shows all three states with the registry's own sentence.
 *
 * `noteKey` names that sentence under `adminShell.availability.notes`; the
 * sentence itself lives in the message catalogue so an operator working in
 * Arabic reads the same disclosure, not a silently dropped one.
 *
 * Keep this in step with the registry when a screen's contract changes.
 */
export type ScreenAvailability = "simulated" | "unavailable" | "read_only";

export const NON_OPERATIONAL: Record<string, { state: ScreenAvailability; noteKey: string }> = {
  "/ai-insights": { state: "unavailable", noteKey: "aiInsights" },
  "/automation": { state: "simulated", noteKey: "automation" },
  "/deals": { state: "simulated", noteKey: "deals" },
  "/pricing": { state: "read_only", noteKey: "pricing" },
  "/quotes": { state: "simulated", noteKey: "quotes" },
  "/approvals": { state: "read_only", noteKey: "approvals" },
  "/performance": { state: "read_only", noteKey: "performance" },
  "/orders": { state: "read_only", noteKey: "orders" },
  "/shipments": { state: "simulated", noteKey: "shipments" },
  "/returns": { state: "simulated", noteKey: "returns" },
  "/warehouse": { state: "read_only", noteKey: "warehouse" },
  "/crm": { state: "read_only", noteKey: "crm" },
  "/segments": { state: "read_only", noteKey: "segments" },
  "/retention": { state: "read_only", noteKey: "retention" },
  "/finance": { state: "read_only", noteKey: "finance" },
  "/payments": { state: "read_only", noteKey: "payments" },
  "/vat": { state: "read_only", noteKey: "vat" },
  "/disputes": { state: "read_only", noteKey: "disputes" },
  "/sla": { state: "read_only", noteKey: "sla" },
  "/integrations": { state: "read_only", noteKey: "integrations" },
  "/audit": { state: "read_only", noteKey: "audit" },
  "/settings": { state: "read_only", noteKey: "settings" },
};

/**
 * This file is a registered navigation source in
 * ops/release/frontend-availability.json — every href below must have an
 * availability contract there, and CI fails the build otherwise.
 *
 * Every group and entry carries a stable `key`, not a display string: the key is
 * what names the message, what identifies a folded group in localStorage and
 * what builds the disclosure ids, so none of that changes when the operator
 * switches to Arabic. The label an operator reads is looked up at render.
 */
const NAV_GROUPS = [
  {
    key: "commandCenter",
    items: [
      { href: "/dashboard", icon: LayoutDashboard, key: "dashboard" },
      { href: "/ai-insights", icon: Brain, key: "aiInsights" },
      { href: "/automation", icon: Zap, key: "automation" },
    ],
  },
  {
    key: "commerce",
    items: [
      { href: "/products", icon: Package, key: "products" },
      { href: "/catalog-import", icon: FileUp, key: "catalogImport" },
      { href: "/categories", icon: Tag, key: "categories" },
      { href: "/brands", icon: Award, key: "brands" },
      { href: "/deals", icon: Percent, key: "deals" },
      { href: "/pricing", icon: Coins, key: "pricing" },
    ],
  },
  {
    key: "b2bTrade",
    items: [
      { href: "/companies", icon: Building2, key: "companies" },
      { href: "/rfqs", icon: FileQuestion, key: "rfqs" },
      { href: "/quotes", icon: Quote, key: "quotes" },
      { href: "/approvals", icon: CheckSquare, key: "approvals" },
    ],
  },
  {
    key: "supplierNetwork",
    items: [
      { href: "/sellers", icon: Store, key: "allSuppliers" },
      { href: "/sellers/pending", icon: Clock, key: "pending", badge: "pending" },
      { href: "/compliance", icon: FileCheck, key: "documents" },
      { href: "/performance", icon: TrendingUp, key: "performance" },
    ],
  },
  {
    key: "orders",
    items: [
      { href: "/orders", icon: ShoppingCart, key: "allOrders" },
      { href: "/shipments", icon: Ship, key: "shipments" },
      { href: "/returns", icon: RotateCcw, key: "returns" },
      { href: "/warehouse/pickpack?tab=dispatch", icon: Send, key: "dispatch" },
    ],
  },
  {
    key: "warehouse",
    items: [
      { href: "/warehouse", icon: Warehouse, key: "warehouseOverview" },
      { href: "/warehouse/inbound", icon: ArrowDownToLine, key: "inbound" },
      { href: "/warehouse/stock", icon: Boxes, key: "stock" },
      { href: "/warehouse/pickpack", icon: PackageCheck, key: "pickPack" },
    ],
  },
  {
    key: "crm",
    items: [
      { href: "/crm", icon: Users, key: "accounts" },
      { href: "/campaigns", icon: Megaphone, key: "campaigns" },
      { href: "/segments", icon: PieChart, key: "segments" },
      { href: "/retention", icon: Heart, key: "retention" },
    ],
  },
  {
    key: "finance",
    items: [
      { href: "/finance", icon: DollarSign, key: "invoices" },
      { href: "/payments", icon: CreditCard, key: "payments" },
      { href: "/settlements", icon: Receipt, key: "settlements" },
      { href: "/vat", icon: FileSpreadsheet, key: "vat" },
    ],
  },
  {
    key: "support",
    items: [
      { href: "/support", icon: LifeBuoy, key: "tickets" },
      { href: "/disputes", icon: Scale, key: "disputes" },
      { href: "/sla", icon: Gauge, key: "slaMonitor" },
    ],
  },
  {
    key: "settings",
    items: [
      { href: "/users", icon: UserCog, key: "users" },
      { href: "/integrations", icon: Plug, key: "integrations" },
      { href: "/audit", icon: ScrollText, key: "auditTrail" },
      { href: "/settings", icon: Settings, key: "settings" },
    ],
  },
];


/** Initial for the avatar: first letter of the real name, else of the email. */
function avatarInitial(name: string | null | undefined, email: string | null | undefined): string {
  const source = name?.trim() || email?.trim() || "";
  return source ? source.charAt(0).toUpperCase() : "";
}

const ALL_HREFS: string[] = NAV_GROUPS.flatMap((group) => group.items.map((item) => item.href));

/**
 * The single nav entry that is the current page, or null when none is.
 *
 * This resolves to ONE entry on purpose. The previous rule tested each entry
 * independently, so `/warehouse/stock` matched both "Stock" (exact) and
 * "Overview" (`/warehouse` as a prefix) and lit two items at once. That was
 * merely untidy while the current item was a coloured fill; now that it is the
 * one RAISED surface in the rail, two of them breaks the elevation law and
 * misreports where the operator actually is. The longest matching href wins,
 * which is the entry that genuinely owns the page.
 *
 * `/dashboard` and the two `/sellers` entries never match by prefix: `/sellers`
 * would otherwise claim `/sellers/pending`.
 *
 * An entry that carries a query string points at a TAB of another entry's page
 * (Dispatch is a tab of Pick/Pack). It never claims the current position, which
 * is the behaviour this navigation already had.
 */
function currentHrefFor(pathname: string): string | null {
  let best: string | null = null;
  for (const href of ALL_HREFS) {
    if (href.includes("?")) continue;
    const exact = pathname === href;
    const prefix =
      href !== "/dashboard" &&
      href !== "/sellers" &&
      href !== "/sellers/pending" &&
      pathname.startsWith(href + "/");
    if ((exact || prefix) && (best === null || href.length > best.length)) best = href;
  }
  return best;
}

const COLLAPSED_KEY = "admin-sidebar-collapsed";
const FOLDED_GROUPS_KEY = "admin-sidebar-folded-groups";

export function AdminLayout({ children, pendingCount = 0 }: { children: React.ReactNode; pendingCount?: number }) {
  const t = useTranslations("adminShell");
  const pathname = usePathname();
  const { data: session, status: sessionStatus } = useSession();
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [profileOpen, setProfileOpen] = React.useState(false);
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const [shortcutHint, setShortcutHint] = React.useState("");
  // Ten groups over forty screens is a wall unless the operator can fold away
  // the areas they do not work in. Every group starts OPEN, so nothing is ever
  // hidden by default and a first visit sees the whole console; folding is a
  // choice the operator makes and we remember.
  const [foldedGroups, setFoldedGroups] = React.useState<string[]>([]);
  const profileRef = React.useRef<HTMLDivElement>(null);
  const profileTriggerRef = React.useRef<HTMLButtonElement>(null);
  const mobileNavRef = React.useRef<HTMLDivElement>(null);
  const mobileDialogRef = React.useRef<HTMLDivElement>(null);
  const mobileTriggerRef = React.useRef<HTMLButtonElement>(null);

  const currentHref = currentHrefFor(pathname);

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

  // Escape closes whichever transient surface is open. Without this the mobile
  // drawer and the account menu were keyboard traps with no exit.
  React.useEffect(() => {
    if (!profileOpen && !mobileOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      // Closing a panel that currently holds focus would drop the caret on
      // <body>; hand it back to the control that opened the panel instead.
      if (profileOpen) profileTriggerRef.current?.focus();
      setProfileOpen(false);
      setMobileOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [profileOpen, mobileOpen]);

  // Move focus into the mobile drawer when it opens, so a keyboard or screen
  // reader user is not left behind on the trigger with the drawer over the page,
  // and hand it back to the trigger on close so they are not dropped at the top
  // of the document.
  React.useEffect(() => {
    if (!mobileOpen) return;
    // Captured on the way in. A ref read inside a cleanup runs at UNMOUNT, by
    // which time mobileTriggerRef.current may already be null — focus would
    // then go nowhere and the reader would be dropped at the top of the
    // document, which is the exact failure this effect exists to prevent.
    const trigger = mobileTriggerRef.current;
    mobileNavRef.current?.querySelector<HTMLElement>("a, button")?.focus();
    return () => trigger?.focus();
  }, [mobileOpen]);

  /**
   * The drawer declares aria-modal, so Tab must actually stay inside it —
   * otherwise assistive technology is told the rest of the page is inert while
   * the keyboard walks straight out into it. The scrim is excluded because it
   * carries tabIndex -1.
   */
  function onMobileKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab") return;
    const nodes = mobileDialogRef.current?.querySelectorAll<HTMLElement>(
      'a[href]:not([tabindex="-1"]), button:not([disabled]):not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])',
    );
    if (!nodes || nodes.length === 0) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  React.useEffect(() => {
    try {
      if (localStorage.getItem(COLLAPSED_KEY) === "true") setCollapsed(true);
      const stored = localStorage.getItem(FOLDED_GROUPS_KEY);
      if (stored) {
        const parsed: unknown = JSON.parse(stored);
        if (Array.isArray(parsed)) setFoldedGroups(parsed.filter((v): v is string => typeof v === "string"));
      }
    } catch {}
  }, []);

  function toggleCollapsed() {
    setCollapsed((v) => {
      const next = !v;
      try { localStorage.setItem(COLLAPSED_KEY, String(next)); } catch {}
      return next;
    });
  }

  function toggleGroup(label: string) {
    setFoldedGroups((current) => {
      const next = current.includes(label) ? current.filter((l) => l !== label) : [...current, label];
      try { localStorage.setItem(FOLDED_GROUPS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }

  /** The badge a nav entry earns: a live count, or an honest availability mark. */
  function navBadge(item: { href: string; badge?: string }): React.ReactNode {
    if (item.badge === "pending" && pendingCount > 0) {
      // The digits are tinted rather than the pill, so an urgent count reads as
      // urgent without a second filled colour in the chrome.
      return <span className="text-warning-ink">{pendingCount > 99 ? "99+" : pendingCount}</span>;
    }
    const availability = NON_OPERATIONAL[item.href];
    if (availability && availability.state !== "read_only") {
      return (
        <>
          <span aria-hidden="true">
            {availability.state === "simulated" ? t("nav.badge.example") : t("nav.badge.notConfigured")}
          </span>
          <span className="sr-only">
            {availability.state === "simulated"
              ? t("nav.badge.exampleDescription")
              : t("nav.badge.notConfiguredDescription")}
          </span>
        </>
      );
    }
    return undefined;
  }

  // Called as a plain function rather than rendered as <SidebarContent />. A
  // component declared inside a render is a NEW component type on every render,
  // so React would unmount and remount the whole rail on every state change —
  // losing the nav's scroll position each time a group is folded. Calling it
  // inlines the elements into this tree instead.
  //
  // `instance` namespaces every generated id. Both rails are in the DOM at the
  // same time — the desktop one is only hidden with CSS — so without it the two
  // copies would share an id and each disclosure button's aria-controls would
  // resolve to the wrong, hidden panel.
  const renderSidebar = (instance: string, onNavigate?: () => void) => (
    // Rung 1: the rail is CONTEXT, so it is recessed, and the current page —
    // which is the one raised, actionable thing in it — reads as lifted out of
    // it rather than as a coloured bar painted on it.
    <Surface rung={1} className="flex h-full flex-col rounded-none border-0 border-e border-border">
      {/* The wordmark. The gradient tile with a font-black "A" is gone: an
          indigo→violet gradient square is the most-copied mark on the internet,
          and the platform name is configuration, never a literal.

          data-console-brow settles this plate off the SAME timeline and the same
          keyframe as the header opposite it, so the two rules that meet at the
          top of the console stay welded together as it condenses. The inner row
          carries the header's own control height as a minimum, which is what
          makes the two blocks resolve to an identical height rather than to two
          numbers that happen to be close. */}
      <div
        data-console-brow=""
        className={cn("flex shrink-0 items-center border-b border-border px-4", collapsed && "justify-center px-2")}
      >
        {collapsed ? (
          <span
            className="fig flex items-center text-ui font-medium text-ink-1"
            style={{ minBlockSize: "var(--control-h-md)" }}
            aria-hidden="true"
          >
            {platformName().charAt(0)}
          </span>
        ) : (
          // One line, two registers. Stacked, the eyebrow made this plate taller
          // than the header it has to agree with; inline, the mark reads as a
          // wordmark rather than as a label with a caption under it.
          <div
            className="flex min-w-0 items-center gap-2"
            style={{ minBlockSize: "var(--control-h-md)" }}
          >
            <p className="u-ui truncate font-medium text-ink-1">{platformName()}</p>
            <Eyebrow as="span" className="shrink-0">{t("nav.brandEyebrow")}</Eyebrow>
          </div>
        )}
      </div>

      <nav
        ref={onNavigate ? mobileNavRef : undefined}
        aria-label={t("nav.sections")}
        className="scrollbar-thin flex-1 overflow-y-auto px-2 py-3"
      >
        {NAV_GROUPS.map((group, groupIndex) => {
          const groupId = `nav-${instance}-group-${group.key}`;
          const folded = !collapsed && foldedGroups.includes(group.key);
          const foldedPending =
            folded && group.items.some((item) => item.badge === "pending") && pendingCount > 0;

          return (
            <div key={group.key} className={cn(groupIndex > 0 && collapsed && "mt-2 border-t border-hairline pt-2")}>
              {!collapsed && (
                // A real <button> with aria-expanded, not a clickable label: the
                // fold has to be reachable and announceable from the keyboard.
                <button
                  type="button"
                  onClick={() => toggleGroup(group.key)}
                  aria-expanded={!folded}
                  aria-controls={groupId}
                  className={cn(
                    "u-focus mb-1 mt-3 flex w-full items-center gap-1.5 rounded-nested px-2 py-1 text-start transition-colors duration-press ease-standard hover:bg-ink-1/[0.04]",
                    groupIndex === 0 && "mt-0",
                  )}
                >
                  <ChevronDown
                    className={cn(
                      "h-3 w-3 shrink-0 text-ink-3 transition-transform duration-press ease-standard",
                      // Folded points along the inline axis, so it flips in Arabic.
                      folded && "-rotate-90 rtl:rotate-90",
                    )}
                    aria-hidden="true"
                  />
                  {/* as="span": a <p> is flow content and a <button> may only
                      contain phrasing content, so the default element would be
                      invalid markup inside this control. */}
                  <Eyebrow as="span" className="truncate">{t(`nav.groups.${group.key}`)}</Eyebrow>
                  {/* Folding a group must not swallow a count that needs action. */}
                  {foldedPending && (
                    <span className="u-meta ms-auto shrink-0 rounded-pill bg-neutral-soft px-1.5 font-medium text-warning-ink">
                      {pendingCount > 99 ? "99+" : pendingCount}
                    </span>
                  )}
                </button>
              )}

              {/* The click handler sits on the container rather than on each
                  NavItem because NavItem's contract is href/label/active and
                  nothing else. A click on any link inside bubbles here, which is
                  all the mobile drawer needs in order to close behind a
                  navigation; the link itself remains the only real control, so
                  keyboard activation works through the same path. */}
              <div
                id={groupId}
                hidden={folded}
                className="space-y-0.5"
                onClick={onNavigate}
              >
                {group.items.map((item) => {
                  // Collapsing the rail is a choice about space, not about
                  // whether a queue still needs a person. The badge pill does
                  // not fit in a 56px rail, so a collapsed entry carries the
                  // count as a dot at its inline end and as part of its
                  // accessible name — the signal survives in both channels
                  // rather than disappearing the way it used to.
                  const pendingHere = item.badge === "pending" && pendingCount > 0;
                  const itemLabel = t(`nav.items.${item.key}`);
                  return (
                    <NavItem
                      key={item.href}
                      href={item.href}
                      label={
                        collapsed && pendingHere
                          ? t("nav.pendingLabel", {
                              label: itemLabel,
                              count: pendingCount,
                              // A bare number renders in the locale's own numeral
                              // system inside an Arabic sentence; this product
                              // uses Western digits everywhere, so it goes in as
                              // a string and the count only selects the plural.
                              value: String(pendingCount),
                            })
                          : itemLabel
                      }
                      icon={item.icon}
                      active={item.href === currentHref}
                      badge={collapsed ? undefined : navBadge(item)}
                      iconOnly={collapsed}
                      linkComponent={Link}
                      className={cn(
                        collapsed && "justify-center px-0",
                        collapsed &&
                          pendingHere &&
                          "after:absolute after:end-1.5 after:top-1.5 after:h-1.5 after:w-1.5 after:rounded-pill after:bg-warning after:content-['']",
                      )}
                    />
                  );
                })}
              </div>

              {/* Groups are separated by a hairline INSIDE the rail rather than
                  by whitespace, which is what lets ten of them stay scannable. */}
              {!collapsed && groupIndex < NAV_GROUPS.length - 1 && !folded && (
                <div className="mt-3 h-px bg-hairline" aria-hidden="true" />
              )}
            </div>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-border p-3">
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className={cn(
            "u-focus u-ui flex w-full items-center gap-2.5 rounded-nested px-3 text-ink-2 transition-colors duration-press ease-standard hover:bg-ink-1/[0.04] hover:text-ink-1",
            collapsed && "justify-center px-0",
          )}
          style={{ minHeight: "var(--control-h-md)" }}
        >
          <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
          {collapsed ? (
            <span className="sr-only">{t("nav.signOut")}</span>
          ) : (
            <span>{t("nav.signOut")}</span>
          )}
        </button>
      </div>
    </Surface>
  );

  // The palette ranks a query against these labels, so it receives the TRANSLATED
  // ones: an operator working in Arabic types Arabic. The availability sentence
  // is looked up from the registry's own key for the same reason.
  const paletteGroups: PaletteGroup[] = NAV_GROUPS.map((group) => ({
    label: t(`nav.groups.${group.key}`),
    items: group.items.map((item) => {
      const availability = NON_OPERATIONAL[item.href];
      return {
        href: item.href,
        label: t(`nav.items.${item.key}`),
        icon: item.icon,
        availability: availability?.state,
        availabilityNote: availability ? t(`availability.notes.${availability.noteKey}`) : undefined,
      };
    }),
  }));

  return (
    // data-console-pane carries the timeline-scope. It sits on the OUTERMOST
    // element on purpose: the rail is a SIBLING of the scrolling pane, and a
    // named scroll timeline is only visible inside the subtree of the element
    // that scopes it — put it on the inner column and the rail's wordmark plate
    // silently falls off the timeline and parks at its end state.
    <div data-console-pane="" className="flex h-screen overflow-hidden bg-transparent">
      {/* Forty navigable screens sit between the top of the document and the
          page itself. Without this, reaching the content by keyboard means
          tabbing past every one of them on every navigation. */}
      {/* Parked just above the viewport rather than hidden with sr-only, so it
          is a real focus target that simply moves into view — no display
          juggling that could leave it unreachable. */}
      <a
        href="#admin-main"
        className="u-focus u-ui fixed -top-20 start-3 z-layer rounded-nested bg-surface-3 px-3 py-2 text-ink-1 shadow-elev-3 focus:top-3"
      >
        {t("nav.skipToContent")}
      </a>

      {/* Desktop sidebar. The width change is deliberately NOT transitioned:
          width is a layout property, so animating it relayouts the whole console
          on every frame — the one thing law 8 forbids outright. The collapse
          lands in a single frame instead, which is also the faster answer. */}
      <aside className={cn("hidden shrink-0 flex-col lg:flex", collapsed ? "w-14" : "w-60")}>
        {renderSidebar("desktop")}
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div
          ref={mobileDialogRef}
          onKeyDown={onMobileKeyDown}
          className="fixed inset-0 z-layer flex lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label={t("nav.sections")}
        >
          <div className="w-60 shrink-0 shadow-elev-5">
            {renderSidebar("mobile", () => setMobileOpen(false))}
          </div>
          {/* tabIndex -1 deliberately: this is a redundant pointer affordance,
              and the keyboard exit is Escape. A focusable element the width of
              the viewport cannot show a legible focus ring — the ring would be
              drawn outside the border box and clipped away — so putting it in
              the Tab cycle would mean a stop where focus is invisible. */}
          <button
            type="button"
            tabIndex={-1}
            className="backdrop-blur-scrim flex-1"
            // The scrim colour and its alpha are both tokens, so this darkens
            // correctly in either theme rather than being a fixed black wash.
            style={{ backgroundColor: "hsl(var(--scrim) / var(--scrim-alpha))" }}
            onClick={() => setMobileOpen(false)}
            aria-label={t("nav.closeNavigation")}
          />
        </div>
      )}

      {/* Main content. The header and the rail's wordmark plate both consume the
          timeline declared by <main> below — see the block at the foot of
          app/globals.css for why the system's scroll(root block) cannot work in
          this shell. */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Rung 4 glass: the one blurred surface in the console at rest. Only
            the bottom edge is drawn — light comes from overhead, so an edge on
            all four sides would be lit from below as well.

            .u-chrome makes it SETTLE rather than toggle: across the first 96px
            of the pane's scroll the glass deepens from .55 to .92 and the
            padding tightens from 18px to 10px, so the bar continuously gains
            weight instead of snapping at a threshold. There is deliberately no
            h-16 or py-* here: a Tailwind height or padding utility out-ranks
            .u-chrome's own padding-block and silently kills half the effect,
            which is the single documented way this gesture ships broken. */}
        <Surface
          as="header"
          rung={4}
          glass
          data-console-chrome=""
          className="u-chrome z-sticky flex shrink-0 items-center justify-between gap-3 rounded-none border-x-0 border-t-0 px-4"
        >
          {/* The header's own controls set the minimum height both top plates
              resolve to; without it the bar would be shorter than the rail's
              wordmark plate on any breakpoint that hides the palette button. */}
          <div className="flex min-w-0 items-center gap-2" style={{ minBlockSize: "var(--control-h-md)" }}>
            {/* PanelLeft draws a panel pinned to the LEFT of its frame. The rail
                it stands for sits at the inline start, which is the right-hand
                side in Arabic, so the glyph is mirrored under [dir="rtl"] — an
                icon that implies a direction has to flip with the script. */}
            <button
              ref={mobileTriggerRef}
              type="button"
              className="u-focus rounded-nested p-1.5 text-ink-2 transition-colors duration-press ease-standard hover:bg-ink-1/[0.06] hover:text-ink-1 lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-expanded={mobileOpen}
              aria-label={t("nav.openNavigation")}
            >
              <PanelLeft className="h-5 w-5 rtl:-scale-x-100" aria-hidden="true" />
            </button>
            <button
              type="button"
              className="u-focus hidden rounded-nested p-1.5 text-ink-2 transition-colors duration-press ease-standard hover:bg-ink-1/[0.06] hover:text-ink-1 lg:flex"
              onClick={toggleCollapsed}
              aria-expanded={!collapsed}
              aria-label={collapsed ? t("nav.expandNavigation") : t("nav.collapseNavigation")}
            >
              <PanelLeft className="h-5 w-5 rtl:-scale-x-100" aria-hidden="true" />
            </button>

            {/* data-rung/data-focus-lift rather than <FieldWell>, because a
                button needs a `type` and FieldWell's props are typed for a
                generic element. The attributes are exactly what FieldWell emits:
                a recessed rung-1 surface, which is what this is — an input
                affordance, and the fastest route to any of forty screens. */}
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              data-rung={1}
              data-focus-lift=""
              className="hidden h-control-md w-72 items-center gap-2 rounded-nested border border-border px-3 text-start outline-none transition-colors duration-press ease-standard hover:border-border-strong sm:flex"
              aria-haspopup="dialog"
              aria-expanded={paletteOpen}
            >
              <Search className="h-3.5 w-3.5 shrink-0 text-ink-3" aria-hidden="true" />
              <span className="u-ui min-w-0 flex-1 truncate text-ink-3">{t("nav.jumpToPage")}</span>
              {shortcutHint && (
                <kbd className="u-micro rounded-nested border border-border px-1.5 py-0.5 text-ink-3">{shortcutHint}</kbd>
              )}
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Only a build that is not a production build gets a badge; a
                production build must not claim to be anything else. */}
            {process.env.NODE_ENV !== "production" && <StatusPill tone="warning">{t("nav.devBuild")}</StatusPill>}
            <ThemeToggle />
            {/* The notification bell that used to sit here is deleted. It was a
                button with no handler behind it, standing in for a notification
                system this platform does not have; the only real number it
                carried — pending supplier applications — is on the Pending nav
                entry and on the dashboard's attention block, both of which go
                somewhere when clicked. */}
            <div className="relative" ref={profileRef}>
              {/* A disclosure, not aria-haspopup="menu": what opens is a small
                  panel holding a link and a button, not a menu widget with
                  arrow-key navigation, and promising one that does not exist is
                  worse for a screen-reader user than promising nothing. */}
              <button
                ref={profileTriggerRef}
                type="button"
                onClick={() => setProfileOpen(v => !v)}
                className="u-focus flex items-center gap-2 rounded-nested p-1.5 transition-colors duration-press ease-standard hover:bg-ink-1/[0.06]"
                aria-expanded={profileOpen}
                aria-label={t("nav.accountMenu")}
              >
                {/* Blank while the session is loading: a placeholder letter would be a made-up identity. */}
                <span
                  className="grid h-7 w-7 place-items-center rounded-pill bg-surface-1 text-meta font-medium text-ink-2 ring-1 ring-border"
                  aria-hidden="true"
                >
                  {initial}
                </span>
                <ChevronDown
                  className={cn("h-3 w-3 text-ink-3 transition-transform duration-press ease-standard", profileOpen && "rotate-180")}
                  aria-hidden="true"
                />
              </button>
              {profileOpen && (
                // Rung 4 but deliberately NOT glass: this panel carries the
                // signed-in identity as body text, and body text never sits on a
                // blur. It is also the console's second floating surface, and
                // the blur budget here is two.
                <Surface rung={4} className="absolute end-0 top-full z-layer mt-1.5 w-60 p-1">
                  {sessionStatus === "loading" ? (
                    <div className="mb-1 border-b border-hairline px-3 py-2.5" aria-busy="true">
                      <div className="skeleton mb-1.5 h-3.5 w-24" />
                      <div className="skeleton h-3 w-36" />
                    </div>
                  ) : user ? (
                    <div className="mb-1 min-w-0 border-b border-hairline px-3 py-2.5">
                      {user.name?.trim() && <p className="u-ui truncate font-medium text-ink-1">{user.name}</p>}
                      {user.email && <p className="u-meta truncate text-ink-3">{user.email}</p>}
                    </div>
                  ) : (
                    <div className="mb-1 border-b border-hairline px-3 py-2.5">
                      <p className="u-meta text-ink-3">{t("nav.identityUnavailable")}</p>
                    </div>
                  )}
                  <Link
                    href="/settings"
                    onClick={() => setProfileOpen(false)}
                    className="u-focus u-ui block rounded-nested px-3 py-2 text-ink-1 transition-colors duration-press ease-standard hover:bg-ink-1/[0.06]"
                  >
                    {t("nav.items.settings")}
                  </Link>
                  <button
                    type="button"
                    onClick={() => signOut({ callbackUrl: "/login" })}
                    className="u-focus u-ui w-full rounded-nested px-3 py-2 text-start text-danger-ink transition-colors duration-press ease-standard hover:bg-danger-soft"
                  >
                    {t("nav.signOut")}
                  </button>
                </Surface>
              )}
            </div>
          </div>
        </Surface>

        {/* tabIndex -1 so the skip link can actually land focus here.
            data-console-scroller declares the named scroll timeline: this
            element, not the document, is what an operator actually scrolls. */}
        <main
          id="admin-main"
          tabIndex={-1}
          data-console-scroller=""
          className="flex-1 overflow-y-auto p-4 outline-none lg:p-6"
        >
          {children}
        </main>
      </div>

      <CommandPalette groups={paletteGroups} open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}
