import Link from "next/link";
import { Mail, ArrowRight, LifeBuoy, FileText } from "lucide-react";
import { platformContacts, platformName } from "@avenick/utils/portal-config";
import { SELLER_REGISTER_URL } from "@/lib/portal-urls";

type FooterLink = { label: string; href: string; external?: boolean };

const COLUMNS: { title: string; links: FooterLink[] }[] = [
  {
    title: "Shop",
    links: [
      { label: "All products", href: "/products" },
      { label: "Brands", href: "/brands" },
      { label: "New arrivals", href: "/products?sort=newest" },
      { label: "Track order", href: "/account/orders" },
    ],
  },
  {
    title: "For business",
    links: [
      { label: "B2B portal", href: "/b2b" },
      { label: "Request a quote", href: "/b2b/rfq/new" },
      // Seller sign-up is in the seller portal. This app's /register creates a
      // buyer account, which is where suppliers used to be sent. When this
      // environment does not know the seller portal's origin there is no
      // correct target, so the link is omitted rather than pointed at a guess.
      ...(SELLER_REGISTER_URL ? [{ label: "Become a seller", href: SELLER_REGISTER_URL, external: true }] : []),
      { label: "B2B catalog", href: "/products" },
      { label: "Returns", href: "/returns" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "Support", href: "/support" },
      { label: "Help center", href: "/support" },
      { label: "Contact us", href: "/support" },
      { label: "My account", href: "/account" },
      { label: "Sign in", href: "/login" },
    ],
  },
];

export function Footer() {
  // Read at render, not at module load: the year must never freeze into the
  // bundle, and the contact address is whatever this deployment configured.
  const year = new Date().getFullYear();
  const brand = platformName();
  const { support } = platformContacts();

  return (
    <footer className="border-t border-border bg-background">
      {/*
        This band used to hold a newsletter form. There is no subscriber model
        and no handler behind it, so "Subscribe" accepted an address and did
        nothing with it. The band now points at the two things a visitor can
        actually do from here: open a support ticket, or request a quote.
      */}
      <div className="border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
          <div>
            <p className="text-lg font-bold tracking-tight">Need a hand?</p>
            <p className="text-muted-foreground text-sm mt-0.5">Order questions go to the help center; bulk pricing goes through a quote request.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Link
              href="/support"
              className="inline-flex items-center justify-center gap-1.5 h-11 px-5 rounded-xl border border-border bg-secondary/60 text-foreground text-sm font-semibold hover:bg-secondary transition-all active:scale-[0.98] whitespace-nowrap"
            >
              <LifeBuoy className="h-4 w-4 text-primary" /> Help center
            </Link>
            <Link
              href="/b2b/rfq/new"
              className="inline-flex items-center justify-center gap-1.5 h-11 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 hover:shadow-glow-sm transition-all active:scale-[0.98] whitespace-nowrap"
            >
              <FileText className="h-4 w-4" /> Request a quote <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
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
            B2B-first. B2C-ready. Built for modern industrial supply and procurement.
          </p>
          {/*
            The support address is configuration, not copy. An environment
            without one shows no address rather than a mailbox nobody reads;
            the help-center link above still reaches a ticket queue.
          */}
          {support && (
            <div className="space-y-2 text-sm mt-5">
              <p className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-3.5 w-3.5 text-primary shrink-0" />
                <a href={`mailto:${support}`} className="hover:text-primary transition-colors">{support}</a>
              </p>
            </div>
          )}
        </div>

        {COLUMNS.map((col) => (
          <div key={col.title}>
            <h3 className="font-semibold mb-4 text-sm">{col.title}</h3>
            <ul className="space-y-2.5">
              {col.links.map(({ label, href, external }) => (
                <li key={label}>
                  {external ? (
                    <a href={href} className="text-sm text-muted-foreground hover:text-primary transition-colors">{label}</a>
                  ) : (
                    <Link href={href} className="text-sm text-muted-foreground hover:text-primary transition-colors">{label}</Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/*
        Bottom. The social icons that used to sit here all linked to "/" —
        four buttons that looked like profiles and went nowhere. There are no
        configured social accounts, so the row holds only the legal links.
      */}
      <div className="border-t border-border">
        <div className="max-w-7xl mx-auto px-4 py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">© {year} {brand}. All rights reserved.</p>
          <div className="flex gap-4 text-xs text-muted-foreground">
            <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
            <Link href="/cookies" className="hover:text-foreground transition-colors">Cookies</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
