"use client";

import * as React from "react";
import Link from "next/link";
import { Users, ChevronDown } from "lucide-react";

type DemoRole = "guest" | "b2c" | "b2b";

const ROLES: { value: DemoRole; label: string; color: string }[] = [
  { value: "guest", label: "Guest", color: "bg-slate-100 text-muted-foreground" },
  { value: "b2c", label: "B2C Customer", color: "bg-blue-50 text-primary" },
  { value: "b2b", label: "B2B Buyer", color: "bg-primary/10 text-primary" },
];

const B2B_NAV = [
  { href: "/b2b", label: "Dashboard" },
  { href: "/b2b/rfq/new", label: "RFQs" },
  { href: "/b2b/quotes", label: "Quotes" },
  { href: "/b2b/register", label: "Company" },
];

const GUEST_NAV = [
  { href: "/products", label: "Products" },
  { href: "/deals", label: "Deals" },
  { href: "/brands", label: "Brands" },
  { href: "/categories/industrial-supplies", label: "Categories" },
];

export function RoleSwitcher() {
  const [role, setRole] = React.useState<DemoRole>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("avenick-demo-role") as DemoRole) ?? "guest";
    }
    return "guest";
  });
  const [open, setOpen] = React.useState(false);

  function selectRole(r: DemoRole) {
    setRole(r);
    localStorage.setItem("avenick-demo-role", r);
    setOpen(false);
  }

  const current = ROLES.find((r) => r.value === role) ?? ROLES[0];
  const navItems = role === "b2b" ? B2B_NAV : GUEST_NAV;

  return (
    <div className="flex items-center gap-3">
      {/* Contextual nav items */}
      <nav className="hidden md:flex items-center gap-1">
        {navItems.map((item) => (
          <Link key={item.href} href={item.href} className="px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-lg transition-colors">
            {item.label}
          </Link>
        ))}
      </nav>

      {/* Role picker */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${current.color} hover:opacity-80`}
          title="Switch demo role"
        >
          <Users className="h-3.5 w-3.5" />
          {current.label}
          <ChevronDown className="h-3 w-3" />
        </button>
        {open && (
          <div className="absolute end-0 top-full mt-1.5 w-48 bg-card border border-border rounded-xl shadow-elevated z-50 p-1">
            <p className="px-2.5 pt-1.5 pb-1 text-[10px] text-muted-foreground font-semibold uppercase tracking-widest">Demo Role</p>
            {ROLES.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => selectRole(r.value)}
                className={`w-full text-start px-2.5 py-2 text-sm rounded-lg transition-colors hover:bg-secondary flex items-center gap-2 ${r.value === role ? "font-semibold bg-secondary/60" : ""}`}
              >
                <span className={`h-2 w-2 rounded-full ${r.value === role ? "bg-primary" : "bg-slate-300"}`} />
                {r.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
