import Link from "next/link";
import { Phone, Mail, MapPin, Facebook, Twitter, Instagram, Linkedin, ArrowRight } from "lucide-react";

const COLUMNS: { title: string; links: [string, string][] }[] = [
  {
    title: "Shop",
    links: [
      ["All products", "/products"],
      ["Deals", "/deals"],
      ["Brands", "/brands"],
      ["New arrivals", "/products?sort=newest"],
      ["Track order", "/account/orders"],
    ],
  },
  {
    title: "For business",
    links: [
      ["B2B portal", "/b2b"],
      ["Request a quote", "/b2b/rfq/new"],
      ["Become a seller", "/register"],
      ["B2B catalog", "/products"],
      ["Returns", "/returns"],
    ],
  },
  {
    title: "Company",
    links: [
      ["Support", "/support"],
      ["Help center", "/support"],
      ["Contact us", "/support"],
      ["My account", "/account"],
      ["Sign in", "/login"],
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-border bg-background">
      {/* Newsletter */}
      <div className="border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
          <div>
            <p className="text-lg font-bold tracking-tight">Stay in the loop</p>
            <p className="text-muted-foreground text-sm mt-0.5">New arrivals, deals, and industry news — once a week.</p>
          </div>
          <form className="flex gap-2 w-full sm:w-auto">
            <input
              type="email"
              placeholder="you@company.com"
              className="flex-1 sm:w-72 h-11 px-4 text-sm rounded-xl bg-secondary/60 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 h-11 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 hover:shadow-glow-sm transition-all active:scale-[0.98] whitespace-nowrap"
            >
              Subscribe <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>

      {/* Main */}
      <div className="max-w-7xl mx-auto px-4 py-12 grid grid-cols-2 lg:grid-cols-5 gap-8">
        {/* Brand */}
        <div className="col-span-2">
          <Link href="/" className="inline-flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-primary-500 to-accent-600 text-white font-black shadow-glow-sm">A</span>
            <span className="text-lg font-extrabold tracking-tight">avenick</span>
          </Link>
          <p className="text-muted-foreground text-sm mt-4 leading-relaxed max-w-xs">
            B2B-first. B2C-ready. Built for modern trade — the GCC&apos;s marketplace
            for industrial supply and procurement.
          </p>
          <div className="space-y-2 text-sm mt-5">
            <p className="flex items-center gap-2 text-muted-foreground"><Phone className="h-3.5 w-3.5 text-primary shrink-0" /> +971 4 234 5678</p>
            <p className="flex items-center gap-2 text-muted-foreground"><Mail className="h-3.5 w-3.5 text-primary shrink-0" /> info@avenick.com</p>
            <p className="flex items-center gap-2 text-muted-foreground"><MapPin className="h-3.5 w-3.5 text-primary shrink-0" /> Dubai, United Arab Emirates</p>
          </div>
        </div>

        {COLUMNS.map((col) => (
          <div key={col.title}>
            <h3 className="font-semibold mb-4 text-sm">{col.title}</h3>
            <ul className="space-y-2.5">
              {col.links.map(([label, href]) => (
                <li key={label}>
                  <Link href={href} className="text-sm text-muted-foreground hover:text-primary transition-colors">{label}</Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Bottom */}
      <div className="border-t border-border">
        <div className="max-w-7xl mx-auto px-4 py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">© 2026 Avenick Commerce. All rights reserved.</p>
          <div className="flex gap-4 text-xs text-muted-foreground">
            <Link href="/support" className="hover:text-foreground transition-colors">Privacy</Link>
            <Link href="/support" className="hover:text-foreground transition-colors">Terms</Link>
            <Link href="/support" className="hover:text-foreground transition-colors">Cookies</Link>
          </div>
          <div className="flex gap-2">
            {[Facebook, Twitter, Instagram, Linkedin].map((Icon, i) => (
              <Link key={i} href="/" aria-label="Social media" className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted-foreground hover:text-primary-foreground hover:bg-primary hover:border-primary transition-colors">
                <Icon className="h-3.5 w-3.5" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
