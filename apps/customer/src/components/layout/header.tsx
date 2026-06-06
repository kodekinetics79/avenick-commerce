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
} from "lucide-react";
import { ThemeToggle } from "@avenick/ui";
import { useCartStore } from "@/stores/cart";
import { useSession, signOut } from "next-auth/react";

function setLocaleCookie(locale: string) {
  document.cookie = `AVENICK_LOCALE=${locale}; path=/; max-age=${60 * 60 * 24 * 365}`;
  window.location.reload();
}

const NAV = [
  { href: "/", label: "Home" },
  { href: "/products", label: "Shop" },
  { href: "/deals", label: "Deals" },
  { href: "/brands", label: "Brands" },
  { href: "/b2b", label: "For Business" },
  { href: "/support", label: "Support" },
];

export function Header() {
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
            <Sparkles className="h-3 w-3 text-primary" /> Free delivery on orders over AED 200 · GCC-wide
          </span>
          <div className="flex items-center gap-3">
            <Link href="/account/orders" className="hover:text-foreground transition-colors">Track order</Link>
            <span className="opacity-40">·</span>
            <button type="button" onClick={() => setLocaleCookie("ar")} className="hover:text-foreground transition-colors">العربية</button>
            <button type="button" onClick={() => setLocaleCookie("en")} className="hover:text-foreground transition-colors">EN</button>
          </div>
        </div>
      </div>

      {/* Main glass header */}
      <div className="glass border-b border-border/70">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center gap-4">
          {/* Logo */}
          <Link href="/" className="shrink-0 flex items-center gap-2 group">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-primary-500 to-accent-600 text-white font-black shadow-glow-sm group-hover:scale-105 transition-transform">A</span>
            <span className="text-lg font-extrabold tracking-tight">avenick</span>
          </Link>

          {/* Nav */}
          <nav className="hidden lg:flex items-center gap-0.5 ms-2">
            {NAV.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="px-3 py-1.5 text-sm font-medium text-muted-foreground rounded-lg hover:text-foreground hover:bg-secondary transition-colors"
              >
                {label}
              </Link>
            ))}
          </nav>

          {/* Search */}
          <form
            className="flex-1 lg:max-w-xs ms-auto flex items-center"
            onSubmit={(e) => {
              e.preventDefault();
              if (search) window.location.href = `/search?q=${encodeURIComponent(search)}`;
            }}
          >
            <div className="relative w-full">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-10 ps-9 pe-3 text-sm rounded-xl bg-secondary/60 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:bg-background transition-all"
                placeholder="Search products…"
              />
            </div>
          </form>

          {/* Actions */}
          <div className="flex items-center gap-1">
            <ThemeToggle className="hidden sm:inline-flex" />
            <Link href="/wishlist" className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors" aria-label="Wishlist">
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
            <div className="relative group">
              <button type="button" className="flex items-center gap-1 p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors" aria-label="Account menu">
                <User className="h-5 w-5" />
                <ChevronDown className="h-3 w-3" />
              </button>
              <div className="absolute end-0 top-full mt-1.5 w-48 rounded-xl border border-border bg-popover text-popover-foreground shadow-elevated opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 p-1">
                {session?.user ? (
                  <>
                    <div className="px-3 py-2 text-sm font-medium truncate border-b border-border mb-1">
                      {session.user.name || session.user.email}
                    </div>
                    {[
                      { href: "/account", label: "My Account" },
                      { href: "/account/orders", label: "Orders" },
                      { href: "/b2b", label: "B2B Portal" },
                    ].map((i) => (
                      <Link key={i.href} href={i.href} className="block px-3 py-2 text-sm rounded-lg hover:bg-secondary transition-colors">{i.label}</Link>
                    ))}
                    <div className="my-1 h-px bg-border" />
                    <button
                      type="button"
                      onClick={() => signOut({ callbackUrl: "/" })}
                      className="w-full text-start flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-secondary transition-colors"
                    >
                      <LogOut className="h-3.5 w-3.5" /> Sign out
                    </button>
                  </>
                ) : (
                  <>
                    {[
                      { href: "/account", label: "My Account" },
                      { href: "/account/orders", label: "Orders" },
                      { href: "/b2b", label: "B2B Portal" },
                    ].map((i) => (
                      <Link key={i.href} href={i.href} className="block px-3 py-2 text-sm rounded-lg hover:bg-secondary transition-colors">{i.label}</Link>
                    ))}
                    <div className="my-1 h-px bg-border" />
                    <Link href="/login" className="block px-3 py-2 text-sm rounded-lg hover:bg-secondary transition-colors">Sign in</Link>
                  </>
                )}
              </div>
            </div>
            <Link
              href="/b2b/rfq/new"
              className="hidden sm:inline-flex items-center gap-1.5 ms-1 h-9 px-3.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 hover:shadow-glow-sm transition-all active:scale-[0.98]"
            >
              <FileText className="h-3.5 w-3.5" /> Get a quote
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
