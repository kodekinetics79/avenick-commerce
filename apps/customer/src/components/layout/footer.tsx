import Link from "next/link";
import { useTranslations } from "next-intl";
import { Mail, ArrowRight, LifeBuoy, FileText } from "lucide-react";
import { Button, Divider, Eyebrow, FieldWell } from "@avenick/ui";
import { platformContacts, platformName } from "@avenick/utils/portal-config";
import { SELLER_REGISTER_URL } from "@/lib/portal-urls";

type FooterLink = { label: string; href: string; external?: boolean };

/** One class for every footer link, so the hit area and the focus ring cannot
 *  drift between the three columns and the legal row. */
const FOOTER_LINK =
  "u-focus u-ui -mx-1 inline-block rounded-nested px-1 py-0.5 text-ink-2 transition-colors duration-hover ease-standard hover:text-ink-1";

export function Footer() {
  // Read at render, not at module load: the year must never freeze into the
  // bundle, and the contact address is whatever this deployment configured.
  const year = new Date().getFullYear();
  const brand = platformName();
  const { support } = platformContacts();
  const t = useTranslations("footer");

  /*
   * Every entry below is a DISTINCT destination, and every label now comes out
   * of the message tree. The whole footer used to be English literals — three
   * column headings, sixteen links, the tagline, the help band and the legal
   * row — which is the defect that shipped last round, sitting on every page of
   * a storefront that ships Arabic.
   *
   * Five of the links this column set used to carry were duplicates wearing a
   * second label — "New arrivals" pointed at /products?sort=newest, which is the
   * catalogue's default ordering and therefore byte-for-byte the "All products"
   * page; "B2B catalog" was /products a third time; and "Help center" and
   * "Contact us" were both /support alongside "Support" itself. A footer padded
   * to a pleasing shape with links that go where the link above them already
   * went is the same failure as an invented statistic: the page is claiming more
   * surface than the product has. Their slots are taken by pages that exist and
   * are genuinely somewhere else.
   */
  const columns: { title: string; links: FooterLink[] }[] = [
    {
      title: t("shop"),
      links: [
        { label: t("allProducts"), href: "/products" },
        { label: t("brands"), href: "/brands" },
        { label: t("wishlist"), href: "/wishlist" },
        { label: t("trackOrder"), href: "/account/orders" },
      ],
    },
    {
      title: t("forBusiness"),
      links: [
        { label: t("b2bPortal"), href: "/b2b" },
        { label: t("requestQuote"), href: "/b2b/rfq/new" },
        { label: t("quotes"), href: "/b2b/quotes" },
        // Seller sign-up is in the seller portal. This app's /register creates a
        // buyer account, which is where suppliers used to be sent. When this
        // environment does not know the seller portal's origin there is no
        // correct target, so the link is omitted rather than pointed at a guess.
        ...(SELLER_REGISTER_URL ? [{ label: t("becomeSeller"), href: SELLER_REGISTER_URL, external: true }] : []),
        { label: t("returns"), href: "/returns" },
      ],
    },
    {
      title: t("company"),
      links: [
        { label: t("support"), href: "/support" },
        { label: t("status"), href: "/status" },
        { label: t("myAccount"), href: "/account" },
        { label: t("signIn"), href: "/login" },
      ],
    },
  ];

  return (
    <footer className="border-t border-border">
      {/*
        This band used to hold a newsletter form. There is no subscriber model
        and no handler behind it, so "Subscribe" accepted an address and did
        nothing with it. The band now points at the two things a visitor can
        actually do from here: open a support ticket, or request a quote.

        It is a rung-1 well with rung-3 buttons raised on top of it, which is
        LAW A stated literally: the band is context, the buttons are the
        actions. It carries the brass rule and NOT the ledger ruling: this band
        is dense small copy, and the one place ruling must never end up is under
        a paragraph.
      */}
      <FieldWell as="div" className="rounded-none border-x-0 border-t-0">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-5 px-4 py-10 sm:flex-row sm:items-center">
          <div>
            <span className="u-drawn mb-4 w-14" data-on="true" aria-hidden="true" />
            <h2 className="u-h3 text-ink-1">{t("helpTitle")}</h2>
            <p className="u-body mt-1 max-w-desc text-ink-2">{t("helpBody")}</p>
          </div>
          <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row">
            <Button asChild variant="secondary" size="md">
              <Link href="/support">
                <LifeBuoy aria-hidden="true" className="h-4 w-4" /> {t("helpCenter")}
              </Link>
            </Button>
            <Button asChild variant="primary" size="md">
              <Link href="/b2b/rfq/new">
                <FileText aria-hidden="true" className="h-4 w-4" /> {t("requestQuote")}
                <ArrowRight aria-hidden="true" className="h-4 w-4 rtl:rotate-180" />
              </Link>
            </Button>
          </div>
        </div>
      </FieldWell>

      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-x-8 gap-y-10 px-4 py-12 lg:grid-cols-5">
        <div className="col-span-2">
          <Link href="/" aria-label={brand} className="u-focus inline-flex items-center gap-2.5 rounded-nested">
            {/*
              The wordmark and the monogram both come from the configured
              platform name. They used to be the literals "A" and "avenick",
              which meant a deployment that renamed the platform still shipped
              somebody else's brand in its own footer.
            */}
            <span
              aria-hidden="true"
              className="grid h-8 w-8 place-items-center rounded-nested bg-ink-1 text-ui font-semibold text-ink-inv shadow-elev-2"
            >
              {brand.charAt(0).toUpperCase()}
            </span>
            <span className="u-h3 text-ink-1">{brand}</span>
          </Link>
          <p className="u-body mt-4 max-w-desc text-ink-2">{t("tagline")}</p>
          {/*
            The support address is configuration, not copy. An environment
            without one shows no address rather than a mailbox nobody reads;
            the help-center link above still reaches a ticket queue.
          */}
          {support && (
            <p className="mt-5 flex items-center gap-2">
              <Mail aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-ink-3" />
              <a href={`mailto:${support}`} aria-label={t("supportEmailAria", { address: support })} className={FOOTER_LINK}>
                {support}
              </a>
            </p>
          )}
        </div>

        {columns.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <Eyebrow as="h2" className="mb-3">
              {col.title}
            </Eyebrow>
            <ul className="space-y-1.5">
              {col.links.map(({ label, href, external }) => (
                <li key={label}>
                  {external ? (
                    <a href={href} className={FOOTER_LINK}>
                      {label}
                    </a>
                  ) : (
                    <Link href={href} className={FOOTER_LINK}>
                      {label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      {/*
        Bottom. The social icons that used to sit here all linked to "/" —
        four buttons that looked like profiles and went nowhere. There are no
        configured social accounts, so the row holds only the legal links.
      */}
      <Divider tone="border" />
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-5 sm:flex-row">
        {/* The year is passed as a STRING on purpose. Handed a number, ICU
            formats it for the locale and 2026 renders as "2,026". */}
        <p className="u-meta text-ink-3">{t("rights", { year: String(year), brand })}</p>
        <nav aria-label={t("legal")} className="flex gap-2">
          <Link href="/privacy" className={FOOTER_LINK}>
            {t("privacy")}
          </Link>
          <Link href="/terms" className={FOOTER_LINK}>
            {t("terms")}
          </Link>
          <Link href="/cookies" className={FOOTER_LINK}>
            {t("cookies")}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
