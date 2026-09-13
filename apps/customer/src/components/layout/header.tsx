"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { platformName } from "@avenick/utils/portal-config";
import { cn } from "@avenick/utils";
import {
  ArrowRight,
  Briefcase,
  ChevronDown,
  Compass,
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
import { BrandLockup, Button, Divider, Eyebrow, NavItem, StickyGlassBar, Surface, ThemeToggle } from "@avenick/ui";
import { useCartStore } from "@/stores/cart";
import { useSearchSuggest } from "@/lib/search-suggest-client";
import { useBrandMenu } from "@/lib/brand-menu-client";
import { useCategoryMenu } from "@/lib/category-menu-client";
import { useDiscoveryLauncher } from "@/components/discovery/discovery-context";
import { useSession, signOut } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
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

/*
 * A 44px hit area for the bar's small controls, on a coarse pointer only.
 *
 * At 390×844 the search submit measured 32×32, and the cart and the menu
 * trigger 38×38, all under the 44px a thumb needs. Growing the controls would
 * take the width from the search field, which is already the tightest thing on
 * a phone's first row. So the VISIBLE control stays the size it is and an
 * empty ::after, which hit-tests as its host, extends past it. A mouse gets the
 * control exactly as drawn, which is why this is media-gated rather than
 * unconditional: on a fine pointer the extension would reach into the next
 * control's gap.
 *
 * The host must already be positioned. None of these carry data-interactive,
 * data-specular or u-shine, which are the three things in the system that also
 * paint ::after.
 */
const COARSE_HIT_44_FROM_38 =
  "[@media(pointer:coarse)]:after:absolute [@media(pointer:coarse)]:after:-inset-[3px] [@media(pointer:coarse)]:after:content-['']";
const COARSE_HIT_44_FROM_32 =
  "[@media(pointer:coarse)]:after:absolute [@media(pointer:coarse)]:after:-inset-1.5 [@media(pointer:coarse)]:after:content-['']";

interface NavEntry {
  href: string;
  /** Key in messages/{en,ar}.json → nav. */
  labelKey: string;
  /** Shown in the mobile sheet only; the desktop nav stays text-only. */
  icon: React.ElementType;
  /** Present when this entry also opens a mega-menu panel. */
  menu?: "shop" | "business" | "brands";
  /**
   * Classes for this entry in the DESKTOP bar only, and only for a plain link
   * (an entry with no panel). The sheet lists every entry at every width, so
   * an entry the bar steps back from stays one tap away on a phone.
   */
  desktopClassName?: string;
}

const NAV: NavEntry[] = [
  // Held back to xl in the bar. The logo beside it is already the home link at
  // every width, and between lg and xl the bar has no room for a second one:
  // with it, the search field measured 118px at 1024 and showed "Se".
  { href: "/", labelKey: "home", icon: Home, desktopClassName: "hidden xl:flex" },
  { href: "/products", labelKey: "shop", icon: Store, menu: "shop" },
  // Deals stays out of primary navigation until governed active promotions
  // exist. The page currently lists ordinary catalog products, so presenting it
  // as "Deals" claims a discount the commercial model does not back.
  // The panel is populated from /api/brands at runtime and only opens when that
  // returns something; see BRAND_COLUMNS below. Without it this stays the plain
  // link it has always been.
  { href: "/brands", labelKey: "brands", icon: Tag, menu: "brands" },
  { href: "/b2b", labelKey: "forBusiness", icon: Briefcase, menu: "business" },
  { href: "/support", labelKey: "support", icon: LifeBuoy },
];

export function Header() {
  const locale = useLocale();
  const t = useTranslations("nav");
  const tc = useTranslations("common");
  const tDiscovery = useTranslations("discovery");
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, status } = useSession();
  /*
   * ANONYMOUS IS A CONFIRMED STATE, NOT THE ABSENCE OF A SESSION. useSession()
   * resolves on the client, so on first paint every visitor is "loading". The
   * signed-in destination sets below are kept until the session is known to be
   * absent. Every surface that changes (the account menu, the business panel,
   * the sheet) is closed at first paint, so the swap is never seen happening.
   */
  const anonymous = status === "unauthenticated";
  const storeCount = useCartStore((s) => s.itemCount());
  // Persisted (localStorage) cart count differs between server and client —
  // only reflect it after mount to avoid a hydration mismatch.
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const itemCount = mounted ? storeCount : 0;

  const [mobileOpen, setMobileOpen] = React.useState(false);
  // The discovery panel has no floating launcher below lg, so the sheet opens
  // it. `available` is the panel's own report of whether it has anything to
  // say; see components/discovery/discovery-context.tsx.
  const discovery = useDiscoveryLauncher();
  const account = useDisclosure("header-account-menu");

  // Active is computed from the real route, never guessed. "/" would otherwise
  // prefix-match every page in the app.
  const isActive = React.useCallback(
    (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`)),
    [pathname],
  );

  const brand = platformName();

  // The theme switch's accessible names, from the message tree. The primitive
  // used to carry them as English literals, which is what an Arabic screen
  // reader heard on the one control in the row that was not translated.
  const themeLabels = { toDark: t("themeToDark"), toLight: t("themeToLight") };

  /*
   * The brands panel, and the one rule that governs whether it opens at all.
   *
   * useBrandMenu() returns only brands that readPublicBrands() judged to have
   * something publicly sellable — the same PUBLICLY_VISIBLE predicate the
   * /brands page uses, so a brand cannot appear here and then show an empty
   * shelf. When it returns nothing (no brands, a failed request, JavaScript
   * off, the first paint before hydration) `brandMenu` is empty, BRAND_COLUMNS
   * is empty, and the render below falls back to the plain link. A nav item
   * that opens an empty panel is worse than one that does not open.
   *
   * The count is used to ORDER the panel and is not printed in it: MegaMenuLink
   * is {href,label}, and widening a shared primitive so one menu can show a
   * number is the "ten new signatures instead of one extended one" failure. The
   * brands page shows the counts, from the same query.
   */
  const brandMenu = useBrandMenu(6);
  const BRAND_COLUMNS: MegaMenuColumn[] =
    brandMenu.length === 0
      ? []
      : [
          {
            title: t("brands"),
            links: brandMenu.map((b) => ({
              href: `/products?brand=${encodeURIComponent(b.slug)}`,
              label: locale === "ar" && b.nameAr ? b.nameAr : b.nameEn,
            })),
          },
          {
            title: t("catalogue"),
            links: [
              { href: "/brands", label: t("allBrands") },
              { href: "/products", label: t("products") },
            ],
          },
        ];

  /*
   * The Shop panel leads with the catalogue's own top-level categories.
   *
   * It used to hold five links, and every one repeated a control within a few
   * hundred pixels: Products was the Shop link itself, Brands the next item in
   * the bar (which now has its own panel), Wishlist and Cart the icons at the
   * end of the bar, and Track orders the utility strip's link. Meanwhile the
   * categories, which are the one way into the catalogue the chrome did not
   * already offer, appeared only in the home page's sidebar.
   *
   * useCategoryMenu() reads /api/categories, which keeps only categories with
   * something publicly discoverable beneath them, so no link here opens an
   * empty shelf. The "no invented category tree" rule below is about inventing
   * one. These are the database's, printed as the catalogue holds them. The
   * Catalogue column keeps Products, the root of every category, and Wishlist,
   * because the header's heart icon is held back to xl and between lg and xl
   * this panel is the bar's only route to it.
   *
   * With no categories (a failed request, JavaScript off, the first paint
   * before hydration) the panel keeps the static columns it has always had
   * rather than collapsing to a bare link. That fallback is also what keeps the
   * wishlist reachable at lg in that case.
   */
  const categoryMenu = useCategoryMenu(8);
  const SHOP_COLUMNS: MegaMenuColumn[] =
    categoryMenu.length > 0
      ? [
          {
            title: t("categories"),
            links: categoryMenu.map((c) => ({
              href: `/products?category=${encodeURIComponent(c.slug)}`,
              label: locale === "ar" && c.nameAr ? c.nameAr : c.nameEn,
            })),
          },
          {
            title: t("catalogue"),
            links: [
              { href: "/products", label: t("products") },
              { href: "/wishlist", label: t("wishlist") },
            ],
          },
        ]
      : [
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
   *
   * WHY THIS IS NOT THE WHOLE SUITE, AND WHY THAT ORPHANS NOTHING. b2b-shell.tsx
   * — a registered navigation source in its own right — already carries every
   * one of the eleven B2B destinations in a persistent grouped sidebar. This
   * panel used to mirror it: twelve links, opened on HOVER, at a visitor who may
   * only have been travelling to /b2b. Three of them (approval policies,
   * billing, spend analytics) are settings nobody navigates to from a storefront
   * header — they are where you go once you are already inside, which is exactly
   * where the shell nav takes over. Removing them from here costs no
   * reachability; it is the same destination list in one place instead of two.
   */
  /*
   * FOR A VISITOR WITH NO SESSION the panel above is nine doors to one room:
   * every one of /b2b/quotes, /b2b/lists, the purchase orders, approvals, the
   * company profile, team and addresses answers 307 to /login. What an
   * anonymous visitor can actually do here is ask for a quote or register a
   * company, so that is the panel they get. /b2b is the registration door for
   * them; it redirects a visitor it cannot place to /b2b/register.
   */
  const BUSINESS_COLUMNS: MegaMenuColumn[] = anonymous
    ? [
        {
          title: t("sourcing"),
          links: [{ href: "/b2b/rfq/new", label: t("getQuote") }],
        },
        {
          title: t("company"),
          links: [{ href: "/b2b", label: t("registerCompany") }],
        },
      ]
    : [
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
          ],
        },
        {
          title: t("company"),
          links: [
            { href: "/b2b", label: t("dashboard") },
            { href: "/b2b/company", label: t("companyProfile") },
            { href: "/b2b/team", label: t("team") },
            { href: "/b2b/addresses", label: t("deliveryAddresses") },
          ],
        },
      ];

  const mobileItems: MobileNavItem[] = NAV.map((entry) => ({
    href: entry.href,
    label: t(entry.labelKey),
    icon: entry.icon,
  }));

  /*
   * THE ACCOUNT DESTINATIONS DEPEND ON THE SESSION, and they used to not.
   *
   * Anonymously, "My account" and "Orders" both answer 307 to /login: two
   * labels for the "Sign in" row right beneath them, above a page that opens
   * with "Welcome back" to someone who has never been here. Meanwhile no header,
   * sheet or footer link reached registration at all. It was only reachable
   * from small links at the bottom of /login.
   *
   * So a visitor with no session gets the door they can use: "Register a
   * company", which is /b2b and lands on the business registration form. It
   * replaces "For business" in the account menu rather than joining it, because
   * for this visitor both are the same page. There is deliberately no personal
   * "Create an account" (/register): no product in this catalogue is sold to
   * consumers, and a personal account would promise a purchase path the
   * catalogue cannot keep.
   *
   * The sheet gets the same door in its account section for parity with the
   * desktop menu, because that is where a phone visitor looks for it. Wishlist
   * and cart stay, since both work without a session. "Sign in" is the session
   * row below either way.
   */
  const mobileAccountItems: MobileNavItem[] = anonymous
    ? [
        { href: "/b2b", label: t("registerCompany"), icon: Briefcase },
        { href: "/wishlist", label: t("wishlist"), icon: Heart },
        { href: "/cart", label: t("cart"), icon: ShoppingCart },
      ]
    : [
        { href: "/account", label: t("myAccount"), icon: User },
        { href: "/account/orders", label: t("orders"), icon: FileText },
        { href: "/wishlist", label: t("wishlist"), icon: Heart },
        { href: "/cart", label: t("cart"), icon: ShoppingCart },
      ];

  const accountLinks = anonymous
    ? [{ href: "/b2b", label: t("registerCompany") }]
    : [
        { href: "/account", label: t("myAccount") },
        { href: "/account/orders", label: t("orders") },
        { href: "/b2b", label: t("forBusiness") },
      ];

  // Live-suggest state. `searchValue` is the input's own text; the hook
  // debounces, aborts superseded requests, and reports "too short" as its own
  // status. The listbox is visible only when there is something to show.
  const [searchValue, setSearchValue] = React.useState("");
  const [suggestOpen, setSuggestOpen] = React.useState(false);
  const [activeSuggestion, setActiveSuggestion] = React.useState(-1);
  const suggestListId = React.useId();
  const suggest = useSearchSuggest(searchValue, { limit: 8 });
  const suggestVisible = suggestOpen && suggest.status === "ready" && suggest.suggestions.length > 0;

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
        // The visible hint is the one word that fits every field this bar
        // draws. "Search the marketplace" was cut to "Search the marke" on
        // every phone, where the text box between the icon and the submit
        // button holds about seventeen characters. The accessible name keeps
        // the full phrase, because a screen reader has no width to run out of.
        placeholder={tc("search")}
        // Recessed: an input is the textbook case for rung 1, and it also gives
        // the field an opaque plate of its own inside the blurred bar.
        data-rung={1}
        className="u-focus u-body h-row w-full rounded-lg border border-border ps-10 pe-11 text-ink-1 placeholder:text-ink-3"
        value={searchValue}
        onChange={(e) => { setSearchValue(e.target.value); setSuggestOpen(true); setActiveSuggestion(-1); }}
        onFocus={() => setSuggestOpen(true)}
        onBlur={() => setTimeout(() => setSuggestOpen(false), 120)}
        onKeyDown={(e) => {
          if (!suggestVisible) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setActiveSuggestion((i) => Math.min(i + 1, suggest.suggestions.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setActiveSuggestion((i) => Math.max(i - 1, -1)); }
          else if (e.key === "Escape") { setSuggestOpen(false); }
          else if (e.key === "Enter" && activeSuggestion >= 0) { e.preventDefault(); const s = suggest.suggestions[activeSuggestion]; if (s) router.push(s.href); }
        }}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={suggestVisible}
        aria-controls={suggestVisible ? suggestListId : undefined}
        aria-activedescendant={activeSuggestion >= 0 ? `${suggestListId}-${activeSuggestion}` : undefined}
        autoComplete="off"
      />
      {/*
        Live suggestions — an ENHANCEMENT on the GET form above, never a
        replacement for it. The form still submits to /search?q= before
        hydration and with scripting off; this listbox only shortens the trip
        for a buyer who is typing. Categories and brands lead (they pivot a
        text search into structured browsing in one click), then products by
        SKU and name. Every row is a real link to a real page; "too short" is
        stated rather than shown as "no matches", because they are different
        facts. Rendered only with results, so nothing floats under an idle
        field.
      */}
      {suggestVisible && (
        <ul
          id={suggestListId}
          role="listbox"
          aria-label={tc("search")}
          className="u-pop absolute inset-x-0 top-full z-layer mt-1.5 max-h-96 overflow-auto rounded-lg border border-border bg-surface-3 p-1 shadow-elev-4"
        >
          {suggest.suggestions.map((sug, i) => (
            <li
              key={`${sug.kind}:${sug.href}`}
              id={`${suggestListId}-${i}`}
              role="option"
              aria-selected={i === activeSuggestion}
            >
              <Link
                href={sug.href}
                className={cn(
                  "u-focus flex items-center gap-2.5 rounded-nested px-2.5 py-2 text-start",
                  i === activeSuggestion ? "bg-surface-2" : "hover:bg-surface-2",
                )}
                onMouseDown={(e) => e.preventDefault()}
              >
                <span className="u-meta w-16 shrink-0 uppercase tracking-wide text-ink-3">{sug.kind}</span>
                <span className="u-ui min-w-0 flex-1 truncate text-ink-1">
                  {sug.parent ? <span className="text-ink-3">{sug.parent.label} › </span> : null}
                  {sug.label}
                </span>
                {sug.sku ? <span className="u-mono u-meta shrink-0 text-ink-3">{sug.sku}</span> : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {/*
        A real GET form rather than a JS handler assigning location.href: the
        search works before hydration and with scripting off, and it lands on
        exactly the same /search?q= it always did.
      */}
      <button
        type="submit"
        aria-label={tc("search")}
        // 32px drawn, 44px to a thumb: end-1.5 plus the 6px extension is
        // exactly the 44px the input's pe-11 reserves, so the enlarged area
        // never reaches typed text.
        className={cn(
          "u-focus absolute inset-y-0 end-1.5 my-auto grid h-8 w-8 place-items-center rounded-nested text-ink-3 transition-colors duration-hover ease-standard hover:text-ink-1",
          COARSE_HIT_44_FROM_32,
        )}
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
      <div className="border-b border-hairline print:hidden">
        <div className="mx-auto flex max-w-shell items-center justify-between gap-4 px-gutter py-1.5">
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
        from 18px to 8px (an 80px bar becoming a 60px one, Apple's nav shrink),
        and a cast shadow fades up beneath it. Zero JS and zero scroll
        listeners; it is a CSS scroll-driven animation on the compositor. The
        blur RADIUS never animates, only the alpha behind it. The search field
        is never hidden at any scroll position: it is the centre of a storefront
        header, and the bar compresses AROUND it.

        WHERE SCROLL TIMELINES DO NOT EXIST (Firefox), the bar stays at its
        uncompressed 18px at every scroll position and only the alpha and the
        shadow flip on the IntersectionObserver fallback. A padding change with
        no timeline to spread it over is a layout jolt at the first pixel of
        scroll, and the owner reviews in Firefox — a settle for some visitors
        and a snap for the rest is two designs, so the padding half is timeline
        or nothing.

        `progress` draws the brass reading hairline along the bar's bottom edge,
        under the glass: the same <ScrollProgress> rule the layout mounts at the
        viewport's top edge, in a different posture, and CSS keeps it to one per
        document. Absent (scaleX(0)) without scroll timelines and under reduced
        motion.

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
      {/* print:hidden, here and on the utility strip above: a buyer who prints
          a product or policy page into a procurement file wants the page, and
          the printout used to open with the delivery strip, the bar and a
          search field. */}
      <StickyGlassBar as="header" progress className="print:hidden">
        <div className="mx-auto flex max-w-shell items-center gap-2 px-gutter sm:gap-3">
          <Link
            href="/"
            aria-label={brand}
            className="group u-focus flex shrink-0 items-center gap-2.5 rounded-nested px-1 py-1"
          >
            {/*
              THE MARK. This was the configured name's first letter in an ink
              plate — the same "a letter where a logo should be" the brands page
              was fixed for, except here no logo existed to read. <BrandMark>
              draws the real one, and it is the ONLY thing in the product that
              draws it: the footer, the auth surfaces, the admin rail, the three
              favicons, the OG images and the email header are now all the same
              geometry module rather than eight divergent boxes.

              Still ink, still not a gradient — the ambient field remains the one
              gradient in the system, and a wordmark is not where the single
              primary fill per view gets spent. The brass is the rule across the
              entry, which is the active-nav indicator in another posture and
              costs ~27 device pixels against a 2% budget.

              A deployment that set NEXT_PUBLIC_PLATFORM_NAME gets its own
              initial on the old plate instead. See BrandMark's docstring.
            */}
            {/* Below sm the mark carries the brand on its own, so the whole
                width the wordmark would take goes to the search field. The
                same trade is made again between lg and xl, where the primary
                nav joins the bar: the wordmark returns at xl. The link keeps
                the brand as its accessible name at every width. */}
            <BrandLockup
              name={brand}
              size={32}
              animated
              wordmarkFrom="sm"
              wordmarkClassName="lg:hidden xl:inline"
              className="gap-2.5"
            />
          </Link>

          <nav aria-label={t("primaryNav")} className="hidden items-center gap-0.5 lg:flex">
            {NAV.map((entry) => {
              const label = t(entry.labelKey);
              const active = isActive(entry.href);
              const columns =
                entry.menu === "shop"
                  ? SHOP_COLUMNS
                  : entry.menu === "business"
                    ? BUSINESS_COLUMNS
                    : entry.menu === "brands"
                      ? BRAND_COLUMNS
                      : [];
              // An entry declares a panel; whether it GETS one depends on there
              // being something to put in it. Only the brands panel is ever
              // empty (the shop panel falls back to its static columns and the
              // business panel is static), and when it is, this falls through
              // to the plain link below.
              if (entry.menu && columns.length > 0) {
                return (
                  <MegaMenu
                    key={entry.href}
                    id={`header-menu-${entry.menu}`}
                    href={entry.href}
                    label={label}
                    menuLabel={t("submenuOf", { label })}
                    active={active}
                    columns={columns}
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
                  className={entry.desktopClassName}
                />
              );
            })}
          </nav>

          {/*
            Search is the centre of a storefront header, so it takes whatever
            the middle of the bar has left, up to max-w-xl, instead of the 20rem
            it used to be squeezed into at the far end. On a phone it is on the
            FIRST row rather than wrapped onto a second one, which is what kept
            the sticky chrome to a single 64px line there.

            "Whatever is left" was very little between lg and xl, where the nav
            joins the bar: 118px at 1024, 189px at 1100, with the placeholder
            cut to "Se". The bar carried two things twice there, the Home item
            beside a logo that is the home link and the wordmark beside a mark
            that already carries the brand, and both step back until xl. The
            quote action and the theme switch stay. The quote action is the
            chrome's one primary fill, and the theme switch has no other home at
            lg and up.
          */}
          <div className="min-w-0 flex-1 lg:max-w-xl">{searchField}</div>

          {/* gap-1.5 below lg is the 6px the cart's and the menu trigger's two
              3px hit extensions need to meet without overlapping. */}
          <div className="flex shrink-0 items-center gap-1.5 lg:gap-1">
            {/*
              Ghost, like the wishlist, cart and account controls beside it. It
              was the one bordered, plated, shadowed chip in a row of flat icons,
              and raised means actionable (LAW A), so the least important control
              in the bar read as its main one. It stays at lg and up because
              below lg it lives in the sheet, whose trigger is lg:hidden.
            */}
            <ThemeToggle variant="ghost" labels={themeLabels} className="hidden lg:inline-flex" />

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
              className={cn(
                "u-focus relative grid h-control-md w-control-md place-items-center rounded-nested text-ink-2 transition-colors duration-hover ease-standard hover:bg-ink-1/[0.06] hover:text-ink-1",
                COARSE_HIT_44_FROM_38,
              )}
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
              className={cn(
                "u-focus relative grid h-control-md w-control-md place-items-center rounded-nested text-ink-2 transition-colors duration-hover ease-standard hover:bg-ink-1/[0.06] hover:text-ink-1 lg:hidden",
                COARSE_HIT_44_FROM_38,
              )}
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
        // "Account", not "My account": the first row of a signed-in sheet is
        // "My account", and a heading that repeats the row under it reads as a
        // stutter. For a visitor with no session there is no "my" yet.
        accountLabel={t("account")}
        items={mobileItems}
        accountItems={mobileAccountItems}
        // The desktop account menu is hidden below lg, so without these the
        // phone had no sign-in link and no way at all to sign out.
        signIn={{ href: "/login", label: t("signIn"), icon: LogIn }}
        signOut={session?.user ? { label: t("signOut"), onSelect: () => signOut({ callbackUrl: "/" }) } : null}
        signedInAs={session?.user ? session.user.name || session.user.email : null}
        // Close the sheet first, then open the panel: the panel is a passive
        // disclosure one rung below the sheet, and it must not open underneath a
        // modal the visitor is about to dismiss anyway.
        discovery={
          discovery?.available
            ? {
                label: tDiscovery("launcher"),
                icon: Compass,
                onSelect: () => {
                  setMobileOpen(false);
                  discovery.open();
                },
              }
            : null
        }
        action={{ href: "/b2b/rfq/new", label: t("getQuote"), icon: FileText }}
        themeLabels={themeLabels}
        isActive={isActive}
      />
    </>
  );
}
