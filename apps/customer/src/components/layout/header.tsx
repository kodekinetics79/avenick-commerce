"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { platformName } from "@avenick/utils/portal-config";
import { cn } from "@avenick/utils";
import {
  ArrowRight,
  Briefcase,
  ChevronDown,
  FileText,
  Heart,
  Home,
  LifeBuoy,
  LogIn,
  LogOut,
  Menu,
  Search,
  ShoppingCart,
  Store,
  Tag,
  User,
} from "lucide-react";
import { Button, Divider, Eyebrow, NavItem, StickyGlassBar, Surface, ThemeToggle } from "@avenick/ui";
import { useCartStore } from "@/stores/cart";
import { useSession, signOut } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useDisclosure } from "./disclosure";
import { LocaleToggle } from "./locale-toggle";
import { MegaMenu, type MegaMenuColumn } from "./mega-menu";
import { MobileNav, type MobileNavItem } from "./mobile-nav";

/**
 * The storefront chrome.
 *
 * THIS FILE IS THE REGISTERED NAVIGATION SOURCE
 * (ops/release/frontend-availability.json → apps.customer.navigationSources).
 * CI fails the build if any href below has no availability contract, so every
 * destination — including the ones rendered by the mega-menu and the mobile
 * sheet — is declared here and passed down as data. Presentation lives in
 * mega-menu.tsx and mobile-nav.tsx; the hrefs do not move out of this file.
 */

/*
 * There is no bilingual literal map in this file any more.
 *
 * It used to carry ~22 strings in both scripts, in code, because the track that
 * wrote this header did not own apps/customer/messages/**. Every one of them now
 * has a key under `nav`, so the mega-menu column titles, the sheet's controls and
 * every aria-label come out of the message tree like everything else. A page
 * where two labels come from the catalogue and one is hardcoded eventually
 * renders half-translated in front of an Arabic buyer, which says the Arabic
 * build is a setting rather than a design.
 */

interface NavEntry {
  href: string;
  /** Key in messages/{en,ar}.json → nav. */
  labelKey: string;
  /** Shown in the mobile sheet only; the desktop nav stays text-only. */
  icon: React.ElementType;
  /** Present when this entry also opens a mega-menu panel. */
  menu?: "shop" | "business";
}

const NAV: NavEntry[] = [
  { href: "/", labelKey: "home", icon: Home },
  { href: "/products", labelKey: "shop", icon: Store, menu: "shop" },
  // Deals stays out of primary navigation until governed active promotions
  // exist. The page currently lists ordinary catalog products, so presenting it
  // as "Deals" claims a discount the commercial model does not back.
  { href: "/brands", labelKey: "brands", icon: Tag },
  { href: "/b2b", labelKey: "forBusiness", icon: Briefcase, menu: "business" },
  { href: "/support", labelKey: "support", icon: LifeBuoy },
];

export function Header() {
  const t = useTranslations("nav");
  const tc = useTranslations("common");
  const pathname = usePathname();
  const { data: session } = useSession();
  const storeCount = useCartStore((s) => s.itemCount());
  // Persisted (localStorage) cart count differs between server and client —
  // only reflect it after mount to avoid a hydration mismatch.
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const itemCount = mounted ? storeCount : 0;

  const [mobileOpen, setMobileOpen] = React.useState(false);
  const account = useDisclosure("header-account-menu");

  // Active is computed from the real route, never guessed. "/" would otherwise
  // prefix-match every page in the app.
  const isActive = React.useCallback(
    (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`)),
    [pathname],
  );

  const brand = platformName();

  const SHOP_COLUMNS: MegaMenuColumn[] = [
    {
      title: t("catalogue"),
      links: [
        { href: "/products", label: t("products") },
        { href: "/brands", label: t("brands") },
      ],
    },
    {
      title: t("ordersAndSaved"),
      links: [
        { href: "/account/orders", label: t("trackOrder") },
        { href: "/wishlist", label: t("wishlist") },
        { href: "/cart", label: t("cart") },
      ],
    },
  ];

  /*
   * The business panel is grouped by what the pages ARE — sourcing, ordering,
   * company governance — because that is the structure the B2B suite actually
   * has. No invented category tree: law 1 applies to navigation as much as to a
   * product card.
   */
  const BUSINESS_COLUMNS: MegaMenuColumn[] = [
    {
      title: t("sourcing"),
      links: [
        { href: "/b2b/rfq/new", label: t("getQuote") },
        { href: "/b2b/quotes", label: t("quotes") },
        { href: "/b2b/lists", label: t("lists") },
      ],
    },
    {
      title: t("ordering"),
      links: [
        { href: "/b2b/purchase-orders", label: t("purchaseOrders") },
        { href: "/b2b/approvals", label: t("approvals") },
        { href: "/b2b/approval-policies", label: t("approvalPolicies") },
      ],
    },
    {
      title: t("company"),
      links: [
        { href: "/b2b", label: t("dashboard") },
        { href: "/b2b/company", label: t("companyProfile") },
        { href: "/b2b/team", label: t("team") },
        { href: "/b2b/addresses", label: t("deliveryAddresses") },
        { href: "/b2b/billing", label: t("billing") },
        { href: "/b2b/analytics", label: t("spendAnalytics") },
      ],
    },
  ];

  const mobileItems: MobileNavItem[] = NAV.map((entry) => ({
    href: entry.href,
    label: t(entry.labelKey),
    icon: entry.icon,
  }));

  const mobileAccountItems: MobileNavItem[] = [
    { href: "/account", label: t("myAccount"), icon: User },
    { href: "/account/orders", label: t("orders"), icon: FileText },
    { href: "/wishlist", label: t("wishlist"), icon: Heart },
    { href: "/cart", label: t("cart"), icon: ShoppingCart },
  ];

  /* The account menu's three destinations do not depend on the session; only
     the identity row and the sign-in / sign-out control do. */
  const accountLinks = [
    { href: "/account", label: t("myAccount") },
    { href: "/account/orders", label: t("orders") },
    { href: "/b2b", label: t("forBusiness") },
  ];

  const searchField = (
    <form role="search" action="/search" method="get" className="relative flex w-full items-center">
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 start-3.5 my-auto h-4 w-4 text-ink-3"
      />
      <input
        type="search"
        name="q"
        aria-label={tc("searchPlaceholder")}
        placeholder={tc("searchPlaceholder")}
        // Recessed: an input is the textbook case for rung 1, and it also gives
        // the field an opaque plate of its own inside the blurred bar.
        data-rung={1}
        className="u-focus u-body h-row w-full rounded-lg border border-border ps-10 pe-11 text-ink-1 placeholder:text-ink-3"
      />
      {/*
        A real GET form rather than a JS handler assigning location.href: the
        search works before hydration and with scripting off, and it lands on
        exactly the same /search?q= it always did.
      */}
      <button
        type="submit"
        aria-label={tc("search")}
        className="u-focus absolute inset-y-0 end-1.5 my-auto grid h-8 w-8 place-items-center rounded-nested text-ink-3 transition-colors duration-hover ease-standard hover:text-ink-1"
      >
        <ArrowRight aria-hidden="true" className="h-4 w-4 rtl:rotate-180" />
      </button>
    </form>
  );

  return (
    /*
      A FRAGMENT, not a <header> wrapper, and that is load-bearing.
      `position: sticky` is constrained by its containing block: an element can
      never be shifted past the padding box of its nearest block ancestor. With
      the bar nested inside a <header> that is only as tall as the chrome, and
      the bar sitting at that box's bottom edge, there is no room to shift it at
      all — it would scroll away with the page and never stick. The bar is
      therefore a direct child of MainLayout's full-height column, and IT carries
      the banner landmark (as="header" below).

      The utility strip stays outside the sticky bar so it scrolls away and the
      chrome condenses to a single line on first scroll. That is a layout answer
      rather than an animated one: collapsing it would mean transitioning a
      height, which the motion contract forbids because it relayouts every frame.
    */
    <>
      <div className="border-b border-hairline">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-1.5">
          {/*
            LAW E. This sentence is the residue of a hardening pass that removed
            a delivery promise nothing could keep. It used to sit behind a
            sparkle icon, dressed as a perk — which is precisely backwards. In
            the provenance voice it reads as the platform stating the terms it
            actually operates under.
          */}
          <p className="u-provenance truncate">{tc("freeDelivery")}</p>
          {/* The links collapse on a phone — the locale control and order
              tracking both live in the mobile sheet — but the provenance line
              stays at every width, because it is the part that is load-bearing. */}
          <div className="hidden shrink-0 items-center gap-3 sm:flex">
            <Link
              href="/account/orders"
              className="u-focus u-meta rounded-nested px-1 py-0.5 text-ink-2 transition-colors duration-hover ease-standard hover:text-ink-1"
            >
              {t("trackOrder")}
            </Link>
            <Divider orientation="vertical" className="h-3.5" />
            <LocaleToggle />
          </div>
        </div>
      </div>

      {/*
        THE CHROME THAT SETTLES. The bar no longer snaps between two states at a
        threshold: across the first 96px of scroll it continuously gains weight —
        the glass fill deepens from .55 to .92, the vertical padding tightens
        from 18px to 10px, and a cast shadow fades up beneath it. Zero JS and
        zero scroll listeners; it is a CSS scroll-driven animation on the
        compositor. The blur RADIUS never animates, only the alpha behind it.

        THE VERTICAL PADDING IS DELIBERATELY NOT A UTILITY HERE. `.u-chrome` sets
        `padding-block: var(--chrome-pad)` and that is the half of the settle that
        moves; a `py-*` class on this row out-ranks it and the bar would tighten
        by nothing at all. Horizontal padding only.

        THE .90 ALPHA PIN THIS BAR USED TO CARRY IS GONE. It existed because the
        round-one bar was glass at EVERY scroll position, so its contrast had to
        hold over whatever imagery happened to be underneath. The settle removes
        that case: the low-alpha frames only exist in the first 96px of scroll,
        when almost nothing has passed under the bar yet, and the floor is now
        .55 precisely because the foundation derived it from the WORST frame of
        the animation rather than the resting state. Re-measure it here if a
        full-bleed gallery is ever put directly under this bar.

        This is the ONE blurred surface in the storefront chrome; the mega-menu
        and the account panel below are opaque rung-4 plates precisely because
        they carry body text. With JS off, before hydration, or with no
        scroll-timeline support, the bar is simply always glass.
      */}
      <StickyGlassBar as="header">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 sm:gap-3">
          <Link
            href="/"
            aria-label={brand}
            className="u-focus flex shrink-0 items-center gap-2.5 rounded-nested px-1 py-1"
          >
            {/*
              The monogram is the configured name's first letter, and it is INK
              rather than the old indigo→violet gradient: the ambient field is
              the one gradient in the system, and a wordmark is not where the
              single primary fill per view should be spent.
            */}
            <span
              aria-hidden="true"
              className="grid h-8 w-8 place-items-center rounded-nested bg-ink-1 text-ui font-semibold text-ink-inv shadow-elev-2"
            >
              {brand.charAt(0).toUpperCase()}
            </span>
            {/* Below sm the monogram carries the mark on its own, so the whole
                width the wordmark would take goes to the search field. */}
            <span className="u-h3 hidden text-ink-1 sm:inline">{brand}</span>
          </Link>

          <nav aria-label={t("primaryNav")} className="hidden items-center gap-0.5 lg:flex">
            {NAV.map((entry) => {
              const label = t(entry.labelKey);
              const active = isActive(entry.href);
              if (entry.menu === "shop" || entry.menu === "business") {
                return (
                  <MegaMenu
                    key={entry.href}
                    id={`header-menu-${entry.menu}`}
                    href={entry.href}
                    label={label}
                    menuLabel={t("submenuOf", { label })}
                    active={active}
                    columns={entry.menu === "shop" ? SHOP_COLUMNS : BUSINESS_COLUMNS}
                  />
                );
              }
              return (
                <NavItem
                  key={entry.href}
                  href={entry.href}
                  label={label}
                  active={active}
                  orientation="horizontal"
                  linkComponent={Link}
                />
              );
            })}
          </nav>

          {/*
            Search is the centre of a storefront header, so it takes the whole
            middle of the bar at every width instead of the 20rem it used to be
            squeezed into at the far end — and on a phone it is on the FIRST
            row rather than wrapped onto a second one, which is what kept the
            sticky chrome to a single 64px line there.
          */}
          <div className="min-w-0 flex-1 lg:max-w-xl">{searchField}</div>

          <div className="flex shrink-0 items-center gap-1">
            <ThemeToggle className="hidden lg:inline-flex" />

            <Link
              href="/wishlist"
              aria-label={t("wishlist")}
              // Held back to xl: between lg and xl the bar is already carrying a
              // nav, a search field and the quote action, and the wishlist is
              // one tap away in the Shop panel either way.
              className="u-focus hidden h-control-md w-control-md place-items-center rounded-nested text-ink-2 transition-colors duration-hover ease-standard hover:bg-ink-1/[0.06] hover:text-ink-1 xl:grid"
            >
              <Heart aria-hidden="true" className="h-[1.15rem] w-[1.15rem]" />
            </Link>

            <Link
              href="/cart"
              aria-label={
                itemCount > 0
                  ? t("cartWithCount", { count: itemCount, n: String(itemCount) })
                  : t("cart")
              }
              className="u-focus relative grid h-control-md w-control-md place-items-center rounded-nested text-ink-2 transition-colors duration-hover ease-standard hover:bg-ink-1/[0.06] hover:text-ink-1"
            >
              <ShoppingCart aria-hidden="true" className="h-[1.15rem] w-[1.15rem]" />
              {itemCount > 0 && (
                /* A count is information, not an action, so it is the ink chip
                   rather than a second primary fill in the same viewport. The
                   digits never animate — law D. */
                <span
                  aria-hidden="true"
                  // tnum + tracking-normal: .u-micro carries 0.06em of tracking,
                  // which lands as trailing space after the last digit and pushes
                  // a two-digit count visibly off-centre inside a round chip.
                  // Tabular figures keep "11" and "99+" the same width.
                  className="tnum u-micro absolute -top-0.5 -end-0.5 grid h-[1.1rem] min-w-[1.1rem] place-items-center rounded-pill bg-ink-1 px-1 tracking-normal text-ink-inv"
                >
                  {itemCount > 99 ? "99+" : itemCount}
                </span>
              )}
            </Link>

            <div className="relative hidden lg:block" {...account.rootProps}>
              <button
                {...account.triggerProps}
                aria-label={t("accountMenu")}
                className="u-focus flex h-control-md items-center gap-1 rounded-nested px-2 text-ink-2 transition-colors duration-hover ease-standard hover:bg-ink-1/[0.06] hover:text-ink-1"
              >
                <User aria-hidden="true" className="h-[1.15rem] w-[1.15rem]" />
                <ChevronDown
                  aria-hidden="true"
                  className={cn(
                    "h-3 w-3 transition-transform duration-hover ease-standard",
                    account.open && "rotate-180",
                  )}
                />
              </button>
              {/* Mounted only while open: `.u-pop`'s @starting-style entry only
                  applies to an element being INSERTED, so a permanently mounted
                  panel toggled with `hidden` animates once, at page load, behind
                  display:none — and every subsequent open is a hard pop. The
                  panel also scales from the trigger's own origin rather than
                  from nowhere, which is the cheapest fix in the product. */}
              {account.open && (
              <Surface
                rung={4}
                id="header-account-menu"
                className="u-pop absolute end-0 top-full z-layer mt-3 w-56 p-1.5"
              >
                {session?.user && (
                  <>
                    <Eyebrow className="px-2.5 pb-1 pt-1.5">{t("myAccount")}</Eyebrow>
                    <p className="truncate px-2.5 pb-2 u-ui font-medium text-ink-1">
                      {session.user.name || session.user.email}
                    </p>
                    <Divider className="mb-1.5" />
                  </>
                )}
                {accountLinks.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="u-focus u-ui block rounded-nested px-2.5 py-2 text-ink-2 transition-colors duration-hover ease-standard hover:bg-ink-1/[0.05] hover:text-ink-1"
                  >
                    {item.label}
                  </Link>
                ))}
                <Divider className="my-1.5" />
                {session?.user ? (
                  <button
                    type="button"
                    onClick={() => signOut({ callbackUrl: "/" })}
                    className="u-focus u-ui flex w-full items-center gap-2 rounded-nested px-2.5 py-2 text-start text-ink-2 transition-colors duration-hover ease-standard hover:bg-ink-1/[0.05] hover:text-ink-1"
                  >
                    <LogOut aria-hidden="true" className="h-3.5 w-3.5" /> {t("signOut")}
                  </button>
                ) : (
                  <Link
                    href="/login"
                    className="u-focus u-ui block rounded-nested px-2.5 py-2 text-ink-2 transition-colors duration-hover ease-standard hover:bg-ink-1/[0.05] hover:text-ink-1"
                  >
                    {t("signIn")}
                  </Link>
                )}
              </Surface>
              )}
            </div>

            {/* The storefront chrome's single primary fill. */}
            {/* size="md" (--control-h-md) so the bar's one commit action matches
                the icon controls beside it instead of sitting 8px shorter than
                everything else in the row. */}
            <Button asChild variant="primary" size="md" className="ms-1 hidden lg:inline-flex">
              <Link href="/b2b/rfq/new">
                <FileText aria-hidden="true" className="h-3.5 w-3.5" />
                {t("getQuote")}
              </Link>
            </Button>

            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              // It opens a dialog, not an inline disclosure, so haspopup names
              // what actually happens to a screen-reader user.
              aria-haspopup="dialog"
              aria-expanded={mobileOpen}
              aria-label={t("openMenu")}
              className="u-focus grid h-control-md w-control-md place-items-center rounded-nested text-ink-2 transition-colors duration-hover ease-standard hover:bg-ink-1/[0.06] hover:text-ink-1 lg:hidden"
            >
              <Menu aria-hidden="true" className="h-5 w-5" />
            </button>
          </div>
        </div>

      </StickyGlassBar>

      <MobileNav
        open={mobileOpen}
        onOpenChange={setMobileOpen}
        title={t("menu")}
        // <Layer>'s close control defaults to the literal "Close". The storefront
        // ships Arabic, so the one control that dismisses the sheet cannot be the
        // one string in it that stays English.
        closeLabel={t("closeMenu")}
        navLabel={t("primaryNav")}
        accountLabel={t("myAccount")}
        items={mobileItems}
        accountItems={mobileAccountItems}
        // The desktop account menu is hidden below lg, so without these the
        // phone had no sign-in link and no way at all to sign out.
        signIn={{ href: "/login", label: t("signIn"), icon: LogIn }}
        signOut={session?.user ? { label: t("signOut"), onSelect: () => signOut({ callbackUrl: "/" }) } : null}
        signedInAs={session?.user ? session.user.name || session.user.email : null}
        action={{ href: "/b2b/rfq/new", label: t("getQuote"), icon: FileText }}
        isActive={isActive}
      />
    </>
  );
}
