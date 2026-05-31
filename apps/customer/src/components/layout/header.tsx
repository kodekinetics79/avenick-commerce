"use client";

import * as React from "react";
import Link from "next/link";
import {
  ShoppingCart,
  Search,
  User,
  ChevronDown,
  Phone,
  Mail,
  Heart,
  FileText,
} from "lucide-react";
import { useCartStore } from "@/stores/cart";

function setLocaleCookie(locale: string) {
  document.cookie = `AVENICK_LOCALE=${locale}; path=/; max-age=${60 * 60 * 24 * 365}`;
  window.location.reload();
}

export function Header() {
  const itemCount = useCartStore((s) => s.itemCount());
  const [search, setSearch] = React.useState("");

  return (
    <header className="sticky top-0 z-50 bg-white">
      {/* Section A — Utility top bar */}
      <div className="bg-slate-900 text-slate-300 text-xs border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 py-1.5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <Phone className="h-3 w-3" /> +971 4 234 5678
            </span>
            <span className="hidden sm:flex items-center gap-1.5">
              <Mail className="h-3 w-3" /> info@avenick.com
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="hover:text-white cursor-pointer transition-colors">Track Order</span>
            <span className="hidden sm:inline hover:text-white cursor-pointer transition-colors">AED ▾</span>
            <button
              type="button"
              onClick={() => setLocaleCookie("ar")}
              className="hover:text-green-400 transition-colors"
            >
              العربية
            </button>
            <button
              type="button"
              onClick={() => setLocaleCookie("en")}
              className="hover:text-green-400 transition-colors"
            >
              English
            </button>
          </div>
        </div>
      </div>

      {/* Section B — Main header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center gap-4">
            {/* Logo */}
            <Link href="/" className="shrink-0">
              <span className="text-xl font-black text-slate-900">Avenick</span>
              <span className="text-xl font-black text-green-600">.</span>
            </Link>

            {/* Nav links - hidden on mobile */}
            <nav className="hidden lg:flex items-center gap-1 flex-1">
              {[
                { href: "/", label: "Home" },
                { href: "/products", label: "Shop" },
                { href: "/products?sort=newest", label: "New Arrivals" },
                { href: "/deals", label: "Deals" },
                { href: "/brands", label: "Brands" },
                { href: "/support", label: "Support" },
              ].map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="px-3 py-2 text-sm font-medium text-slate-700 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                >
                  {label}
                </Link>
              ))}
            </nav>

            {/* Search */}
            <form
              className="flex-1 lg:flex-none lg:w-64 flex items-center"
              onSubmit={(e) => {
                e.preventDefault();
                if (search) window.location.href = `/search?q=${encodeURIComponent(search)}`;
              }}
            >
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 h-9 px-3 text-sm border border-gray-200 border-e-0 rounded-s-xl focus:outline-none focus:ring-2 focus:ring-green-400"
                placeholder="Search products..."
              />
              <button
                type="submit"
                title="Search"
                className="h-9 px-3 bg-green-600 hover:bg-green-700 text-white rounded-e-xl transition-colors"
              >
                <Search className="h-4 w-4" />
              </button>
            </form>

            {/* Actions */}
            <div className="flex items-center gap-1">
              <Link
                href="/wishlist"
                className="p-2 hover:bg-gray-50 rounded-xl transition-colors"
                title="Wishlist"
                aria-label="Wishlist"
              >
                <Heart className="h-5 w-5 text-slate-600" />
              </Link>

              <Link
                href="/cart"
                className="relative p-2 hover:bg-gray-50 rounded-xl transition-colors"
                aria-label="Shopping cart"
              >
                <ShoppingCart className="h-5 w-5 text-slate-600" />
                {itemCount > 0 && (
                  <span className="absolute -top-0.5 -end-0.5 h-4 w-4 rounded-full bg-green-600 text-white text-[10px] flex items-center justify-center font-bold">
                    {itemCount > 99 ? "99+" : itemCount}
                  </span>
                )}
              </Link>

              <div className="relative group">
                <button
                  type="button"
                  className="flex items-center gap-1 p-2 hover:bg-gray-50 rounded-xl transition-colors"
                  aria-label="Account menu"
                >
                  <User className="h-5 w-5 text-slate-600" />
                  <ChevronDown className="h-3 w-3 text-slate-400" />
                </button>
                <div className="absolute end-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-xl shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 py-1">
                  <Link
                    href="/account"
                    className="block px-4 py-2 text-sm text-slate-700 hover:bg-green-50 hover:text-green-600"
                  >
                    My Account
                  </Link>
                  <Link
                    href="/account/orders"
                    className="block px-4 py-2 text-sm text-slate-700 hover:bg-green-50 hover:text-green-600"
                  >
                    Orders
                  </Link>
                  <Link
                    href="/b2b"
                    className="block px-4 py-2 text-sm text-slate-700 hover:bg-green-50 hover:text-green-600"
                  >
                    B2B Portal
                  </Link>
                  <hr className="my-1" />
                  <Link
                    href="/login"
                    className="block px-4 py-2 text-sm text-slate-700 hover:bg-green-50 hover:text-green-600"
                  >
                    Sign In
                  </Link>
                </div>
              </div>

              <Link
                href="/b2b/rfq/new"
                className="hidden sm:flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-3 py-2 rounded-xl transition-colors ml-1"
              >
                <FileText className="h-3.5 w-3.5" /> RFQ
              </Link>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
