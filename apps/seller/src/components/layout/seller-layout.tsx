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
  Settings, Menu, PanelLeftClose, PanelLeftOpen, ChevronDown, LogOut, Search, BarChart3, Info
} from "lucide-react";
import { signOut } from "next-auth/react";
import { useTranslations } from "next-intl";
import { cn } from "@avenick/utils";
import {
  Divider, Eyebrow, Layer, Meter, NavItem, Num, Surface, ThemeToggle, TierMark,
  type MeterTone,
} from "@avenick/ui";
import { CommandPalette } from "@/components/command-palette";
import { NotificationBell } from "@/components/notification-bell";
import { ToastProvider } from "@/components/toast";
import { sellerNavigationAllows } from "@/lib/seller-permissions";

/**
 * Lucide draws Send as a paper plane travelling toward the inline end, and
 * LogOut as an arrow leaving through a door on the inline end. Both are
 * direction-implying glyphs, so both mirror under [dir="rtl"] — law 3 governs
 * the icon set as much as it governs the layout, and an arrow that still points
 * at the right-hand edge in Arabic points away from the exit.
 */
type IconProps = React.ComponentProps<typeof Send>;
function mirrored(Icon: React.ComponentType<IconProps>) {
  return function MirroredIcon({ className, ...props }: IconProps) {
    return <Icon className={cn(className, "rtl:-scale-x-100")} {...props} />;
  };
}
const SendRtl = mirrored(Send);
const LogOutRtl = mirrored(LogOut);

/**
 * The navigation is declared at module scope, where no translator exists, so an
 * entry carries the KEY of its label rather than the label itself:
 * `labelKey` resolves under sellerShell.nav.groups / sellerShell.nav.items in
 * SellerLayout, which is the first place a hook may be called. Nothing here is a
 * user-visible string — hrefs, icons and permissions are code.
 */
interface NavItemDef {
  href: string;
  icon: React.ElementType;
  /** Key under sellerShell.nav.items. */
  labelKey: string;
  badge?: "issues" | "messages";
  permissions: string[];
}

export const NAV_GROUPS: { labelKey: string; items: NavItemDef[] }[] = [
  {
    labelKey: "overview",
    items: [
      { href: "/dashboard", icon: LayoutDashboard, labelKey: "dashboard", permissions: ["dashboard.view"] },
      { href: "/analytics", icon: BarChart3, labelKey: "analytics", permissions: ["analytics.view"] },
      { href: "/performance", icon: TrendingUp, labelKey: "performance", permissions: ["analytics.view"] },
    ],
  },
  {
    labelKey: "catalog",
    items: [
      { href: "/products", icon: Package, labelKey: "products", permissions: ["catalog.view", "catalog.manage"] },
      { href: "/inventory", icon: Boxes, labelKey: "inventory", permissions: ["inventory.view", "inventory.manage"] },
      // /issues renders the listing-issue queue (nav.items.listingIssues) — it
      // was never a bulk uploader.
      { href: "/issues", icon: AlertTriangle, labelKey: "listingIssues", badge: "issues", permissions: ["catalog.view", "catalog.manage"] },
    ],
  },
  {
    labelKey: "orders",
    items: [
      { href: "/orders", icon: ShoppingCart, labelKey: "orders", permissions: ["orders.view", "orders.fulfill"] },
      { href: "/shipments", icon: Truck, labelKey: "shipments", permissions: ["shipments.view", "shipments.manage"] },
      { href: "/returns", icon: RotateCcw, labelKey: "returns", permissions: ["returns.view", "returns.manage"] },
    ],
  },
  {
    labelKey: "rfq",
    items: [
      // /messages is the shared inbox: buyer threads and RFQs live in one place.
      { href: "/messages", icon: Inbox, labelKey: "inbox", badge: "messages", permissions: ["rfqs.view"] },
      { href: "/quotes/submit", icon: SendRtl, labelKey: "submitQuote", permissions: ["quotes.submit"] },
      { href: "/quotes", icon: Clock, labelKey: "quoteHistory", permissions: ["rfqs.view"] },
    ],
  },
  {
    labelKey: "finance",
    items: [
      { href: "/payouts", icon: DollarSign, labelKey: "payouts", permissions: ["finance.view"] },
      { href: "/invoices", icon: FileText, labelKey: "invoices", permissions: ["finance.view"] },
      { href: "/commission", icon: CreditCard, labelKey: "commission", permissions: ["finance.view"] },
    ],
  },
  {
    labelKey: "documents",
    items: [
      { href: "/documents", icon: FolderOpen, labelKey: "documentCenter", permissions: ["documents.view", "documents.manage"] },
      // The onboarding page is the seller's own readiness checklist; nothing
      // else links to it, so removing this entry orphaned the route.
      { href: "/onboarding", icon: CheckSquare, labelKey: "onboarding", permissions: ["documents.view", "documents.manage"] },
      { href: "/compliance", icon: CheckSquare, labelKey: "compliance", permissions: ["documents.view", "documents.manage"] },
    ],
  },
  {
    labelKey: "support",
    items: [
      { href: "/support/tickets", icon: LifeBuoy, labelKey: "tickets", permissions: ["support.view"] },
      { href: "/support/contact", icon: MessageSquare, labelKey: "contactAdmin", permissions: ["support.view"] },
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

/**
 * Band thresholds are presentation only — they colour the meter, they do not
 * produce the score.
 *
 * The band now tints exactly one thing: the 1.5px meter fill. It used to tint
 * the whole pill, its border and the figure itself, which is a red/amber/green
 * box a supplier looks at sixty times a day — at that frequency a traffic light
 * stops carrying information and starts carrying fatigue. The reading is carried
 * by the length of the bar and by the figure; the colour is a hairline of
 * confirmation, not the message.
 */
function scoreTone(score: number): MeterTone {
  if (score >= 80) return "success";
  if (score >= 60) return "warning";
  return "danger";
}

/**
 * Sidebar pill for the performance score. Lives at module scope so it has a
 * stable component identity and can own its own disclosure state — as does
 * every other piece of the sidebar now. The info control is a sibling of the
 * link, not a child: a button inside an anchor is invalid markup and breaks
 * keyboard focus.
 */
function PerformancePill({ performance }: { performance: PerformanceView | null }) {
  const t = useTranslations("sellerShell");
  const [open, setOpen] = React.useState(false);
  const panelId = React.useId();
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const rootRef = React.useRef<HTMLDivElement>(null);

  // Escape closes the explanation and returns focus to the control that opened
  // it. The old version opened on hover and closed on blur, which meant a
  // keyboard user could never read it: the moment they tabbed toward it, it went.
  //
  // Outside-click closes it too, for parity with the notification panel and the
  // account menu: three disclosures in one shell that dismiss by three different
  // rules is the kind of inconsistency a supplier feels without being able to
  // name it. Only the panel dismisses on the outside click — the click itself is
  // never swallowed, so the sidebar link underneath still navigates.
  React.useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [open]);

  if (performance === null) {
    return (
      <div className="border-b border-hairline px-2 py-2.5">
        <Link
          href="/performance"
          className="u-focus block rounded-nested px-3 py-2 transition-colors duration-hover ease-standard hover:bg-ink-1/[0.04]"
        >
          <Eyebrow>{t("score.title")}</Eyebrow>
          {/* score.notEnoughData — the honest absence, not a zero. */}
          <span className="u-ui mt-0.5 block font-medium text-ink-1">{t("score.notEnoughData")}</span>
        </Link>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="relative border-b border-hairline px-2 py-2.5">
      <div className="flex items-start gap-1">
        <Link
          href="/performance"
          className="u-focus min-w-0 flex-1 rounded-nested px-3 py-2 transition-colors duration-hover ease-standard hover:bg-ink-1/[0.04]"
        >
          <Eyebrow>{t("score.title")}</Eyebrow>
          {/* The figure is a <Num>: tabular, at inline figure rank, and never the
              thing that animates. "/ 100" is its unit, not part of the number —
              and it carries no word, so it is notation rather than copy. */}
          <Num className="mt-0.5" value={performance.score} unit="/ 100" />
          <Meter
            className="mt-2"
            size="sm"
            value={performance.score}
            tone={scoreTone(performance.score)}
            label={t("score.meterLabel", { score: String(performance.score) })}
          />
        </Link>
        <button
          ref={triggerRef}
          type="button"
          aria-label={t("score.howCalculated")}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((v) => !v)}
          className="u-focus mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-nested text-ink-3 transition-colors duration-press ease-standard hover:bg-ink-1/[0.06] hover:text-ink-1"
        >
          <Info className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
      {open && (
        // Rung 4, and deliberately NOT glass: this panel is all body text, and
        // law 5 does not allow that contrast to depend on what is scrolled
        // behind it.
        //
        // No role="tooltip": a tooltip is a short text label, and several screen
        // readers flatten its contents to a single string. This is a disclosure —
        // it holds a list and three sentences, it is opened by click, and the
        // trigger already declares it with aria-expanded/aria-controls. The
        // labelling comes from the trigger, so the region needs no role of its own.
        <Surface
          rung={4}
          id={panelId}
          className="absolute start-2 top-full z-layer mt-1 w-64 space-y-2 p-3"
        >
          {/* The provenance of the score, in the provenance voice. This is the
              basis and the window — the number is not credible without it. */}
          <p className="u-provenance text-meta text-ink-2">
            {t("score.provenance", { days: String(performance.windowDays) })}
          </p>
          <ul className="space-y-1">
            {performance.components.map((component) => (
              <li key={component.key} className="flex items-start justify-between gap-2">
                <span className="u-meta text-ink-3">
                  {component.label}
                  <span className="u-mono ms-1 text-micro">×{component.weight}</span>
                </span>
                <span className="u-meta u-mono shrink-0 text-ink-2">
                  {component.share === null
                    ? t("score.noData")
                    : t("score.goodOfTotal", { good: String(component.good), total: String(component.total) })}
                </span>
              </li>
            ))}
          </ul>
          <p className="u-meta text-ink-3">{t("score.weightsNote")}</p>
        </Surface>
      )}
    </div>
  );
}

/**
 * SellerTier is a stored enum, and <TierMark> prints its `tier` prop verbatim
 * unless a `label` is supplied — so the brass pill in the rail and in the
 * account menu read "PLATINUM" in the Arabic build. The storefront's supplier
 * card documents this exact trap and this follows its contract: the labels are a
 * caller-supplied enum→label map (sellerShell.tier, keyed by the stored value,
 * with only the labels translated), and a tier the message tree does not name
 * renders no pill at all rather than falling back to the enum.
 */
const TIER_KEYS = new Set(["STANDARD", "VERIFIED", "GOLD", "PLATINUM"]);

function SellerTierMark({ tier, className }: { tier: string; className?: string }) {
  const t = useTranslations("sellerShell.tier");
  if (!TIER_KEYS.has(tier)) return null;
  return <TierMark tier={tier} label={t(tier)} className={className} />;
}

/**
 * The seller's monogram. A rung-1 recessed plate with the initial in ink, not
 * the old indigo→violet gradient tile: the ambient field is the only gradient in
 * the system, and a gradient avatar is the single most copied SaaS tell there is.
 */
function SellerMark({ name, className }: { name: string; className?: string }) {
  return (
    <Surface
      rung={1}
      aria-hidden="true"
      className={cn("grid shrink-0 place-items-center rounded-nested font-medium text-ink-1", className)}
    >
      {name.charAt(0).toUpperCase()}
    </Surface>
  );
}

/** A nav entry with its label already resolved against the message tree. */
type NavItemView = Omit<NavItemDef, "labelKey"> & { label: string };
type NavGroupView = { label: string; items: NavItemView[] };

/**
 * Which single nav entry the current route belongs to, resolved by the LONGEST
 * matching href.
 *
 * The per-item test this replaces — `pathname === href || pathname.startsWith(
 * href + "/")` — matched more than one entry whenever one route nests under
 * another. On /quotes/submit both "Submit Quote" and "Quote History" came back
 * active: two rung-3 surfaces and two brass rules in a portal whose whole budget
 * is one raised surface per viewport, and no answer at all to "where am I".
 * Longest match is the only rule that stays correct as routes are added.
 */
function resolveActiveHref(groups: NavGroupView[], pathname: string): string | null {
  let best: string | null = null;
  for (const group of groups) {
    for (const item of group.items) {
      if (pathname !== item.href && !pathname.startsWith(item.href + "/")) continue;
      if (best === null || item.href.length > best.length) best = item.href;
    }
  }
  return best;
}

/**
 * The navigation itself, at module scope so it keeps a stable component identity
 * across layout renders. It used to be an inline `SidebarContent` arrow function
 * declared inside SellerLayout, which React treats as a NEW component type on
 * every render: the entire sidebar unmounted and remounted on every state change
 * in the shell, losing its scroll position and any open disclosure with it.
 */
function SellerNav({
  groups,
  activeHref,
  collapsed,
  issueCount,
  unreadMessages,
}: {
  groups: NavGroupView[];
  /** Resolved once by resolveActiveHref, so exactly one entry can be current. */
  activeHref: string | null;
  collapsed: boolean;
  issueCount: number;
  unreadMessages: number;
}) {
  const t = useTranslations("sellerShell");
  return (
    <>
      {groups.map((group, groupIndex) => (
        <div key={group.label} className={groupIndex > 0 ? "mt-3" : undefined}>
          {/* Collapsed, the group label cannot be shown — but the GROUPING still
              has to survive, or the rail is an undifferentiated stack of
              nineteen icons. A hairline stands in for the heading. */}
          {collapsed
            ? groupIndex > 0 && <Divider className="mx-2 mb-3" />
            : <Eyebrow className="mb-1 px-3">{group.label}</Eyebrow>}

          <div className="space-y-0.5">
            {group.items.map((item) => {
              const isActive = item.href === activeHref;
              const badgeCount =
                item.badge === "issues" ? issueCount :
                item.badge === "messages" ? unreadMessages : 0;
              const shown = badgeCount > 9 ? "9+" : String(badgeCount);

              const navItem = (
                <NavItem
                  href={item.href}
                  // Collapsed there is no visible text, so the count has to live
                  // in the accessible name or a screen-reader user loses it.
                  label={collapsed && badgeCount > 0 ? t("shell.navItemWithCount", { label: item.label, count: shown }) : item.label}
                  icon={item.icon}
                  active={isActive}
                  iconOnly={collapsed}
                  linkComponent={Link}
                  badge={
                    !collapsed && badgeCount > 0
                      ? (
                        // The chip stays neutral; only the figure inside it takes
                        // a tone. Four semantic states exist in this system and a
                        // count of unfixed listings is a warning, not an alarm —
                        // nothing in this sidebar pulses.
                        <span className={item.badge === "issues" ? "text-warning-ink" : "text-ink-1"}>
                          {shown}
                        </span>
                      )
                      : undefined
                  }
                />
              );

              if (!collapsed) return <React.Fragment key={item.href}>{navItem}</React.Fragment>;

              return (
                // The native tooltip is the only label a sighted user gets on an
                // icon rail, and the dot carries the count that the chip cannot —
                // so the tooltip has to carry the count too, or the dot means
                // nothing to the one reader who can see it and not the label.
                <span
                  key={item.href}
                  className="relative block"
                  title={badgeCount > 0 ? t("shell.navItemWithCount", { label: item.label, count: shown }) : item.label}
                >
                  {navItem}
                  {badgeCount > 0 && (
                    <span
                      aria-hidden="true"
                      className={cn(
                        "pointer-events-none absolute end-1 top-1 h-1.5 w-1.5 rounded-pill",
                        item.badge === "issues" ? "bg-warning" : "bg-primary",
                      )}
                    />
                  )}
                </span>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}

/**
 * The sidebar body, shared verbatim by the desktop rail and the mobile drawer so
 * the two can never drift. `variant` changes only how it is mounted: the rail
 * paints its own recessed surface and owns its own scroll, the drawer sits
 * inside <Layer>, which already provides both.
 */
function SidebarBody({
  variant,
  collapsed,
  groups,
  pathname,
  activeHref,
  sellerName,
  tier,
  performance,
  issueCount,
  unreadMessages,
  canManageSettings,
}: {
  variant: "rail" | "drawer";
  collapsed: boolean;
  groups: NavGroupView[];
  pathname: string;
  activeHref: string | null;
  sellerName?: string;
  tier?: string;
  performance?: PerformanceView | null;
  issueCount: number;
  unreadMessages: number;
  canManageSettings: boolean;
}) {
  const t = useTranslations("sellerShell");
  const isRail = variant === "rail";

  const body = (
    <>
      {/* Seller identity — only what the page actually knows about the seller.
          The band is always 64px so the rail's first rule lines up with the top
          bar's, even for a page that passed neither a name nor a tier. */}
      <div className={cn("flex h-16 shrink-0 items-center gap-3 border-b border-hairline px-3", collapsed && "justify-center px-2")}>
        {sellerName && <SellerMark name={sellerName} className="h-9 w-9 text-ui" />}
        {!collapsed && (sellerName || tier) && (
          <div className="min-w-0">
            {sellerName && <p className="u-ui truncate font-medium text-ink-1">{sellerName}</p>}
            {/* Brass, in one of its three permitted uses in the whole product. */}
            {tier && <SellerTierMark tier={tier} className="mt-1 block" />}
          </div>
        )}
      </div>

      {/* Performance score — hidden unless the page computed one */}
      {!collapsed && performance !== undefined && <PerformancePill performance={performance} />}

      <nav
        aria-label={t("shell.navAriaLabel")}
        className={cn(
          "px-2 py-3",
          // scrollbar-thin, not scrollbar-hide: a nineteen-item nav that scrolls
          // with no visible scrollbar hides the fact that there is more below it.
          isRail && "flex-1 overflow-y-auto scrollbar-thin",
        )}
      >
        <SellerNav
          groups={groups}
          activeHref={activeHref}
          collapsed={collapsed}
          issueCount={issueCount}
          unreadMessages={unreadMessages}
        />
      </nav>

      <div className="shrink-0 space-y-0.5 border-t border-hairline p-2">
        {canManageSettings && (
          <span className="block" title={collapsed ? t("shell.settings") : undefined}>
            <NavItem
              href="/settings"
              label={t("shell.settings")}
              icon={Settings}
              active={pathname === "/settings" || pathname.startsWith("/settings/")}
              iconOnly={collapsed}
              linkComponent={Link}
            />
          </span>
        )}
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          aria-label={collapsed ? t("shell.signOut") : undefined}
          title={collapsed ? t("shell.signOut") : undefined}
          className={cn(
            "u-ui u-focus flex w-full items-center gap-2.5 rounded-nested px-3 text-ink-2",
            "transition-colors duration-hover ease-standard hover:bg-ink-1/[0.04] hover:text-ink-1",
            collapsed && "justify-center px-0",
          )}
          style={{ minHeight: "var(--control-h-md)" }}
        >
          <LogOutRtl className="h-4 w-4 shrink-0" aria-hidden="true" />
          {!collapsed && <span>{t("shell.signOut")}</span>}
        </button>
      </div>
    </>
  );

  if (!isRail) return <div className="-mx-1 flex flex-col">{body}</div>;

  // Rung 1: navigation is CONTEXT, so it is recessed, and the raised current
  // position inside <NavItem> reads as lifting out of the field rather than as a
  // coloured bar painted on top of it. Square corners and a single inline-end
  // edge, because a full-height rail is not a card.
  return (
    <Surface rung={1} bare className="flex h-full flex-col rounded-none border-e border-border">
      {body}
    </Surface>
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
  const t = useTranslations("sellerShell");
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState(false);
  const [accountOpen, setAccountOpen] = React.useState(false);
  const accountRef = React.useRef<HTMLDivElement>(null);
  const accountTriggerRef = React.useRef<HTMLButtonElement>(null);
  const accountMenuId = React.useId();

  React.useEffect(() => {
    try {
      const stored = localStorage.getItem("seller-sidebar-collapsed");
      if (stored === "true") setCollapsed(true);
    } catch {}
  }, []);

  // The mobile drawer closes when the route actually changes rather than on the
  // click that requested it, so it never closes on a navigation that failed.
  React.useEffect(() => {
    setSidebarOpen(false);
    setAccountOpen(false);
  }, [pathname]);

  /**
   * ...and it closes when the viewport reaches the breakpoint that replaces it
   * with the permanent rail.
   *
   * <Layer> is a real modal: a scrim, a focus trap, Escape and a scroll lock. The
   * `lg:hidden` on it hides the PANEL only — the scrim, the trap and the lock are
   * portalled siblings and know nothing about the breakpoint. Rotate a tablet or
   * drag a window wider with the drawer open and the whole app went behind a
   * blurred scrim with no visible panel and no visible way out. State that a
   * media query hides has to be state a media query also ends.
   */
  React.useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const sync = () => { if (query.matches) setSidebarOpen(false); };
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  // Outside click and Escape for the account disclosure. This menu used to open
  // on :hover only, which made it unreachable by keyboard and by touch, and left
  // its links focusable while `invisible` — focus would land on content nobody
  // could see.
  React.useEffect(() => {
    if (!accountOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(event.target as Node)) setAccountOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setAccountOpen(false);
      accountTriggerRef.current?.focus();
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [accountOpen]);

  function toggleCollapsed() {
    setCollapsed((v) => {
      const next = !v;
      try { localStorage.setItem("seller-sidebar-collapsed", String(next)); } catch {}
      return next;
    });
  }

  const can = (required: readonly string[]) => sellerNavigationAllows(permissions, required);

  // Permission filtering is unchanged: an item the membership cannot reach is
  // dropped, and a group left with no items is dropped with it rather than
  // rendering a heading over nothing. This is also where each entry's labelKey
  // becomes a label — the first point in the tree where a translator exists.
  const groups: NavGroupView[] = React.useMemo(
    () =>
      NAV_GROUPS
        .map((group) => ({
          label: t(`nav.groups.${group.labelKey}`),
          items: group.items
            .filter((item) => sellerNavigationAllows(permissions, item.permissions))
            .map(({ labelKey, ...item }) => ({ ...item, label: t(`nav.items.${labelKey}`) })),
        }))
        .filter((group) => group.items.length > 0),
    [permissions, t],
  );

  const activeHref = React.useMemo(() => resolveActiveHref(groups, pathname), [groups, pathname]);

  // The top bar names where you are. It used to say "Seller Central" on every
  // one of the nineteen pages, which is the one thing the reader already knows —
  // and when the rail is collapsed or the viewport is narrow, the current
  // section was not stated anywhere at all.
  //
  // It reads the SAME resolved href the rail marks, so the raised nav entry and
  // the words in the bar can never disagree.
  const location = React.useMemo(() => {
    if (activeHref) {
      for (const group of groups) {
        const item = group.items.find((candidate) => candidate.href === activeHref);
        if (item) return { group: group.label, label: item.label };
      }
    }
    if (pathname === "/settings" || pathname.startsWith("/settings/")) {
      return { group: t("nav.groups.account"), label: t("shell.settings") };
    }
    return null;
  }, [groups, pathname, activeHref, t]);

  return (
    <ToastProvider>
      <CommandPalette permissions={permissions} />
      {/* No background on the shell. <body> paints --surface-0 and the ambient
          field sits behind it at z-index -1; an opaque wrapper here would cover
          both, which is how a tinted ground silently becomes flat white again. */}
      <div className="flex h-screen overflow-hidden">
        {/* Desktop rail. The width is deliberately NOT transitioned: width is a
            layout property, and animating one thrashes layout on every frame of
            the collapse. The state has already changed, so it arrives at once. */}
        <aside className={cn("hidden shrink-0 lg:flex lg:flex-col", collapsed ? "w-14" : "w-56")}>
          <SidebarBody
            variant="rail"
            collapsed={collapsed}
            groups={groups}
            pathname={pathname}
            activeHref={activeHref}
            sellerName={sellerName}
            tier={tier}
            performance={performance}
            issueCount={issueCount}
            unreadMessages={unreadMessages}
            canManageSettings={can(["settings.manage"])}
          />
        </aside>

        {/* Mobile drawer. The same <Layer> that carries the customer cart drawer
            and the admin approval modal, so it arrives with a focus trap, Escape,
            a scroll lock and the shared Z entry — none of which the hand-rolled
            overlay it replaces had. */}
        <Layer
          open={sidebarOpen}
          onOpenChange={setSidebarOpen}
          side="start"
          size="sm"
          title={sellerName ? t("shell.drawerTitle", { name: sellerName }) : t("shell.drawerTitleFallback")}
          hideTitle
          closeLabel={t("shell.closeMenu")}
          // Belt to the effect above's braces. This class hides the PANEL at lg,
          // but the scrim, the focus trap and the scroll lock are portalled
          // siblings that no media query reaches — the effect is what actually
          // retires the drawer when the rail takes over.
          className="lg:hidden"
        >
          {/* Tapping the entry for the page you are already on produces no route
              change, so the pathname effect never fires and the drawer sat open
              over the page it had just been asked to show. Delegation rather than
              a per-link handler, and scoped to the no-op case only, so a real
              navigation still closes on arrival rather than on the click. Enter on
              a focused link raises a click too, so this works from the keyboard. */}
          <div
            onClick={(event) => {
              const link = (event.target as HTMLElement).closest("a");
              if (!link) return;
              const href = link.getAttribute("href");
              if (href && new URL(href, window.location.origin).pathname === pathname) setSidebarOpen(false);
            }}
          >
            <SidebarBody
              variant="drawer"
              collapsed={false}
              groups={groups}
              pathname={pathname}
              activeHref={activeHref}
              sellerName={sellerName}
              tier={tier}
              performance={performance}
              issueCount={issueCount}
              unreadMessages={unreadMessages}
              canManageSettings={can(["settings.manage"])}
            />
          </div>
        </Layer>

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {/* Rung 0 with a single edge, not glass. The main column scrolls in its
              own box and never passes underneath this bar, so a backdrop-filter
              here would blur nothing while spending one of the portal's two
              permitted blurred surfaces. */}
          <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-border px-3 sm:px-4">
            <div className="flex min-w-0 items-center gap-1">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                aria-label={t("shell.openMenu")}
                className="u-focus grid h-9 w-9 shrink-0 place-items-center rounded-nested text-ink-2 transition-colors duration-press ease-standard hover:bg-ink-1/[0.06] hover:text-ink-1 lg:hidden"
              >
                <Menu className="h-5 w-5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={toggleCollapsed}
                aria-label={collapsed ? t("shell.expandNav") : t("shell.collapseNav")}
                className="u-focus hidden h-9 w-9 shrink-0 place-items-center rounded-nested text-ink-2 transition-colors duration-press ease-standard hover:bg-ink-1/[0.06] hover:text-ink-1 lg:grid"
              >
                {/* A panel icon implies a side, so it mirrors in Arabic where the
                    rail itself is on the other edge. */}
                {collapsed
                  ? <PanelLeftOpen className="h-5 w-5 rtl:-scale-x-100" aria-hidden="true" />
                  : <PanelLeftClose className="h-5 w-5 rtl:-scale-x-100" aria-hidden="true" />}
              </button>

              {location && (
                <div className="min-w-0 ps-1.5">
                  <Eyebrow className="truncate">{location.group}</Eyebrow>
                  <p className="u-ui truncate font-medium text-ink-1">{location.label}</p>
                </div>
              )}

              {/* data-rung is the system's own contract, and it is what makes this
                  control recessed: it looks like the search input it stands in
                  for, and it re-declares --ring-offset-surface so the two-stop
                  focus ring's inner stop matches the ground it is drawn on.
                  <Surface> cannot be used here because it types its props as a
                  generic element and would reject `type="button"`. */}
              <button
                type="button"
                data-rung={1}
                aria-haspopup="dialog"
                aria-keyshortcuts="Meta+K Control+K"
                onClick={() => window.dispatchEvent(new Event("open-command-palette"))}
                className="u-focus ms-3 hidden items-center gap-2 rounded-nested border border-border px-2.5 text-meta text-ink-3 transition-colors duration-hover ease-standard hover:text-ink-1 md:flex"
                style={{ height: "var(--control-h-md)" }}
              >
                <Search className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{t("shell.search")}</span>
                <kbd className="u-mono ms-3 rounded-sm border border-border px-1 text-micro">⌘K</kbd>
              </button>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <ThemeToggle />
              <NotificationBell />
              <Link
                href="/messages"
                className="u-focus relative grid h-9 w-9 place-items-center rounded-nested text-ink-2 transition-colors duration-press ease-standard hover:bg-ink-1/[0.06] hover:text-ink-1"
                aria-label={
                  unreadMessages > 0
                    ? t("shell.messagesUnread", { count: unreadMessages > 9 ? "9+" : String(unreadMessages) })
                    : t("shell.messages")
                }
              >
                <MessageSquare className="h-5 w-5" aria-hidden="true" />
                {unreadMessages > 0 && (
                  // end-/top-, never right-: the count has to sit on the trailing
                  // corner of the icon in both scripts.
                  <span
                    aria-hidden="true"
                    className="absolute end-1 top-1 grid h-4 min-w-4 place-items-center rounded-pill bg-danger px-1 text-micro font-medium text-danger-foreground"
                  >
                    {unreadMessages > 9 ? "9+" : unreadMessages}
                  </span>
                )}
              </Link>

              <div className="relative" ref={accountRef}>
                <button
                  ref={accountTriggerRef}
                  type="button"
                  onClick={() => setAccountOpen((v) => !v)}
                  aria-haspopup="true"
                  aria-expanded={accountOpen}
                  aria-controls={accountMenuId}
                  aria-label={sellerName ? t("shell.accountMenuFor", { name: sellerName }) : t("shell.accountMenu")}
                  className="u-focus flex items-center gap-2 rounded-nested p-1.5 text-ink-2 transition-colors duration-press ease-standard hover:bg-ink-1/[0.06] hover:text-ink-1"
                >
                  {sellerName ? (
                    <>
                      <SellerMark name={sellerName} className="h-7 w-7 rounded-pill text-meta" />
                      <span className="u-ui hidden max-w-[110px] truncate font-medium text-ink-1 sm:block">{sellerName}</span>
                    </>
                  ) : (
                    <Settings className="h-4 w-4" aria-hidden="true" />
                  )}
                  <ChevronDown
                    className={cn("h-3 w-3 transition-transform duration-press ease-standard", accountOpen && "rotate-180")}
                    aria-hidden="true"
                  />
                </button>

                {accountOpen && (
                  <Surface rung={4} id={accountMenuId} className="absolute end-0 top-full z-layer mt-1.5 w-52 p-1">
                    {(sellerName || tier) && (
                      <div className="border-b border-hairline px-3 pb-2.5 pt-2">
                        {sellerName && <p className="u-ui truncate font-medium text-ink-1">{sellerName}</p>}
                        {tier && <SellerTierMark tier={tier} className="mt-1 block" />}
                      </div>
                    )}
                    <div className="pt-1">
                      <Link
                        href="/performance"
                        className="u-ui u-focus block rounded-nested px-3 py-2 text-ink-2 transition-colors duration-press ease-standard hover:bg-ink-1/[0.06] hover:text-ink-1"
                      >
                        {t("shell.performance")}
                      </Link>
                      <Link
                        href="/settings"
                        className="u-ui u-focus block rounded-nested px-3 py-2 text-ink-2 transition-colors duration-press ease-standard hover:bg-ink-1/[0.06] hover:text-ink-1"
                      >
                        {t("shell.settings")}
                      </Link>
                      <button
                        type="button"
                        onClick={() => signOut({ callbackUrl: "/login" })}
                        className="u-ui u-focus flex w-full items-center gap-2 rounded-nested px-3 py-2 text-start text-danger-ink transition-colors duration-press ease-standard hover:bg-danger-soft"
                      >
                        <LogOutRtl className="h-3.5 w-3.5" aria-hidden="true" /> {t("shell.signOut")}
                      </button>
                    </div>
                  </Surface>
                )}
              </div>
            </div>
          </header>

          {/* data-scroll-container marks the element that actually scrolls in this
              shell. <body> never does — the shell is h-screen overflow-hidden — so
              anything that wants to lock scrolling behind a layer has to lock this
              box, not the document. */}
          <main data-scroll-container className="flex-1 overflow-y-auto p-4 lg:p-6">
            {children}
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
