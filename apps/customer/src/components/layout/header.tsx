"use client";

import * as React from "react";
import Link from "next/link";
import {
  ShoppingCart,
  Search,
  User,
  ChevronDown,
  Heart,
  FileText,
  Sparkles,
  LogOut,
  Menu,
} from "lucide-react";
import { ThemeToggle } from "@avenick/ui";
import { useCartStore } from "@/stores/cart";
import { useSession, signOut } from "next-auth/react";
import { useTranslations } from "next-intl";

function setLocaleCookie(locale: string) {
  document.cookie = `AVENICK_LOCALE=${locale}; path=/; max-age=${60 * 60 * 24 * 365}`;
  window.location.reload();
}

const NAV = [
  { href: "/", labelKey: "home" },
  { href: "/products", labelKey: "shop" },
  { href: "/deals", labelKey: "deals" },
  { href: "/brands", labelKey: "brands" },
  { href: "/b2b", labelKey: "forBusiness" },
  { href: "/support", labelKey: "support" },
] as const;

export function Header() {
  const t = useTranslations("nav");
  const tc = useTranslations("common");
  const { data: session } = useSession();
  const storeCount = useCartStore((s) => s.itemCount());
  const [search, setSearch] = React.useState("");
  // Persisted (localStorage) cart count differs between server and client —
  // only reflect it after mount to avoid a hydration mismatch.
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const itemCount = mounted ? storeCount : 0;

  return (
    <header className="sticky top-0 z-50">
      {/* Slim utility strip */}
      <div className="hidden sm:block border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 h-8 flex items-center justify-between text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Sparkles className="h-3 w-3 text-primary" /> {tc("freeDelivery")}
          </span>
          <div className="flex items-center gap-3">
            <Link href="/account/orders" className="hover:text-foreground transition-colors">{t("trackOrder")}</Link>
            <span className="opacity-40">·</span>
            <button type="button" onClick={() => setLocaleCookie("ar")} className="hover:text-foreground transition-colors">العربية</button>
            <button type="button" onClick={() => setLocaleCookie("en")} className="hover:text-foreground transition-colors">EN</button>
          </div>
        </div>
      </div>

      {/* Main glass header */}
      <div className="glass border-b border-border/70">
        <div className="max-w-7xl mx-auto px-4 min-h-16 py-3 flex flex-wrap items-center gap-x-3 gap-y-2 lg:flex-nowrap">
          {/* Logo */}
          <Link href="/" className="shrink-0 flex items-center gap-2 group">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-primary-500 to-accent-600 text-white font-black shadow-glow-sm group-hover:scale-105 transition-transform">A</span>
            <span className="text-lg font-extrabold tracking-tight">avenick</span>
          </Link>

          {/* Nav */}
          <nav aria-label="Primary navigation" className="hidden lg:flex items-center gap-0.5 ms-2">
            {NAV.map(({ href, labelKey }) => (
              <Link
                key={href}
                href={href}
                className="px-3 py-1.5 text-sm font-medium text-muted-foreground rounded-lg hover:text-foreground hover:bg-secondary transition-colors"
              >
                {t(labelKey)}
              </Link>
            ))}
          </nav>

          {/* Search */}
          <form
            role="search"
            className="order-last flex w-full items-center lg:order-none lg:ms-auto lg:max-w-xs lg:flex-1"
            onSubmit={(e) => {
              e.preventDefault();
              if (search) window.location.href = `/search?q=${encodeURIComponent(search)}`;
            }}
          >
            <div className="relative w-full">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <input
                aria-label={tc("searchPlaceholder")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-10 ps-9 pe-3 text-sm rounded-xl bg-secondary/60 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:bg-background transition-all"
                placeholder={tc("searchPlaceholder")}
              />
            </div>
          </form>

          {/* Actions */}
          <div className="flex items-center gap-1">
            <ThemeToggle className="hidden sm:inline-flex" />
            <Link href="/wishlist" className="hidden sm:inline-flex p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Wishlist">
              <Heart className="h-5 w-5" />
            </Link>
            <Link href="/cart" className="relative p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors" aria-label="Shopping cart">
              <ShoppingCart className="h-5 w-5" />
              {itemCount > 0 && (
                <span className="absolute -top-0.5 -end-0.5 h-4 min-w-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-bold shadow-glow-sm">
                  {itemCount > 99 ? "99+" : itemCount}
                </span>
              )}
            </Link>
            <details className="group relative">
              <summary className="flex cursor-pointer list-none items-center gap-1 rounded-xl p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden" aria-label="Account menu">
                <User className="h-5 w-5" />
                <ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" />
              </summary>
              <div className="absolute end-0 top-full z-50 mt-1.5 w-48 rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-elevated">
                {session?.user ? (
                  <>
                    <div className="px-3 py-2 text-sm font-medium truncate border-b border-border mb-1">
                      {session.user.name || session.user.email}
                    </div>
                    {[
                      { href: "/account", label: t("myAccount") },
                      { href: "/account/orders", label: t("orders") },
                      { href: "/b2b", label: t("forBusiness") },
                    ].map((i) => (
                      <Link key={i.href} href={i.href} className="block px-3 py-2 text-sm rounded-lg hover:bg-secondary transition-colors">{i.label}</Link>
                    ))}
                    <div className="my-1 h-px bg-border" />
                    <button
                      type="button"
                      onClick={() => signOut({ callbackUrl: "/" })}
                      className="w-full text-start flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-secondary transition-colors"
                    >
                      <LogOut className="h-3.5 w-3.5" /> {t("signOut")}
                    </button>
                  </>
                ) : (
                  <>
                    {[
                      { href: "/account", label: t("myAccount") },
                      { href: "/account/orders", label: t("orders") },
                      { href: "/b2b", label: t("forBusiness") },
                    ].map((i) => (
                      <Link key={i.href} href={i.href} className="block px-3 py-2 text-sm rounded-lg hover:bg-secondary transition-colors">{i.label}</Link>
                    ))}
                    <div className="my-1 h-px bg-border" />
                    <Link href="/login" className="block px-3 py-2 text-sm rounded-lg hover:bg-secondary transition-colors">{t("signIn")}</Link>
                  </>
                )}
              </div>
            </details>
            <Link
              href="/b2b/rfq/new"
              className="hidden sm:inline-flex items-center gap-1.5 ms-1 h-9 px-3.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 hover:shadow-glow-sm transition-all active:scale-[0.98]"
            >
              <FileText className="h-3.5 w-3.5" /> {t("getQuote")}
            </Link>

            <details className="group relative lg:hidden">
              <summary className="grid h-10 w-10 cursor-pointer list-none place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden" aria-label="Open primary navigation">
                <Menu className="h-5 w-5" />
              </summary>
              <nav aria-label="Mobile primary navigation" className="absolute end-0 top-full z-50 mt-1.5 w-64 rounded-2xl border border-border bg-popover p-2 text-popover-foreground shadow-elevated">
                {NAV.map(({ href, labelKey }) => (
                  <Link key={href} href={href} className="block rounded-xl px-3 py-2.5 text-sm font-medium hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    {t(labelKey)}
                  </Link>
                ))}
                <div className="my-1 h-px bg-border" />
                <Link href="/wishlist" className="block rounded-xl px-3 py-2.5 text-sm font-medium hover:bg-secondary sm:hidden">Wishlist</Link>
                <Link href="/b2b/rfq/new" className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-primary hover:bg-primary/10">
                  <FileText className="h-4 w-4" /> {t("getQuote")}
                </Link>
                <div className="mt-1 flex items-center gap-2 border-t border-border px-3 pt-2">
                  <button type="button" onClick={() => setLocaleCookie("ar")} className="min-h-10 flex-1 rounded-lg text-sm hover:bg-secondary">العربية</button>
                  <button type="button" onClick={() => setLocaleCookie("en")} className="min-h-10 flex-1 rounded-lg text-sm hover:bg-secondary">EN</button>
                </div>
              </nav>
            </details>
          </div>
        </div>
      </div>
    </header>
  );
}
