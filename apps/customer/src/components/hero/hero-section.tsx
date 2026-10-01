import Image from "next/image";
import Link from "next/link";
import { ArrowRight, FileText, ShoppingBag } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button, Eyebrow, Reveal, Surface } from "@avenick/ui";
import { storefrontProductHref } from "@/lib/product-card-commerce";
import type { HeroSlide } from "./hero-slides";

/**
 * The public storefront's first decision surface.
 *
 * It demonstrates the two buying modes already supported by the product:
 * catalogue discovery and multi-line RFQ creation. The RFQ plate is labelled
 * as a preview and is built from real catalogue rows, so it explains capability
 * without pretending that an anonymous visitor is looking at a live request.
 */
export async function HeroSection({ slides }: { slides: HeroSlide[]; priceLine?: string | null }) {
  const t = await getTranslations("home");
  const previewLines = slides.slice(0, 3);
  const specimen = slides[0];

  return (
    <section className="relative isolate overflow-hidden rounded-[1.75rem] border border-border bg-surface-2 shadow-elev-2 lg:grid lg:min-h-[35rem] lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
      <div className="relative z-10 flex flex-col justify-center px-6 py-10 sm:px-10 sm:py-14 lg:px-14 lg:py-16">
        <Reveal index={0}>
          <Eyebrow tone="brass">{t("heroTagline")}</Eyebrow>
        </Reveal>

        <Reveal index={1} as="h1" className="u-hero mt-4 max-w-[12ch] text-ink-1">
          <span className="block font-medium">{t("heroTitle1")}</span>{" "}
          <span className="block text-primary-ink">{t("heroTitle2")}</span>
        </Reveal>

        <Reveal index={2}>
          <p className="u-lead mt-5 max-w-desc text-ink-2">{t("heroDesc")}</p>
        </Reveal>

        <Reveal index={3}>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Button variant="primary" size="lg" asChild>
              <Link href="/b2b/rfq/new">
                <FileText className="h-4 w-4" aria-hidden="true" />
                {t("heroPrimary")}
                <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
              </Link>
            </Button>
            <Button variant="link" size="lg" asChild>
              <Link href="/products">
                <ShoppingBag className="h-4 w-4" aria-hidden="true" />
                {t("heroSecondary")}
              </Link>
            </Button>
          </div>
        </Reveal>

        <Reveal index={4}>
          <dl className="mt-9 grid max-w-xl grid-cols-3 divide-x divide-hairline rtl:divide-x-reverse">
            {[t("proof1"), t("proof2"), t("proof3")].map((label) => (
              <div key={label} className="px-3 first:ps-0 last:pe-0">
                <dt className="u-meta font-medium text-ink-1">{label}</dt>
              </div>
            ))}
          </dl>
        </Reveal>
      </div>

      <div className="relative min-h-[28rem] overflow-hidden border-t border-hairline lg:min-h-0 lg:border-s lg:border-t-0">
        <picture>
          <source media="(max-width: 639px)" srcSet="/hero/avenick-industrial-dusk-mobile-900.png" />
          <Image
            src="/hero/avenick-industrial-dusk-1600.png"
            alt=""
            aria-hidden="true"
            fill
            priority
            sizes="(min-width: 1024px) 54vw, 100vw"
            className="object-cover object-center"
          />
        </picture>
        <div aria-hidden="true" className="absolute inset-0 bg-ink-1/15" />

        {specimen?.imageUrl ? (
          <Link
            href={storefrontProductHref(specimen.slug, { currency: specimen.currency ?? undefined })}
            aria-label={t("specimenView", { name: specimen.name })}
            className="u-focus absolute bottom-6 end-5 h-[15rem] w-[15rem] rounded-[1.5rem] sm:bottom-8 sm:end-8 sm:h-[19rem] sm:w-[19rem]"
          >
            <Image
              src={specimen.imageUrl}
              alt=""
              aria-hidden="true"
              fill
              sizes="(min-width: 640px) 19rem, 15rem"
              className="object-contain drop-shadow-2xl transition-transform duration-hover ease-standard hover:-translate-y-1 hover:scale-[1.02]"
            />
          </Link>
        ) : null}

        {previewLines.length > 0 ? (
          <Surface rung={4} className="absolute start-4 top-4 z-10 w-[min(22rem,calc(100%-2rem))] overflow-hidden sm:start-6 sm:top-6">
            <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
              <div>
                <p className="u-micro font-semibold uppercase tracking-[0.12em] text-primary-ink rtl:tracking-normal">
                  {t("rfqPreviewEyebrow")}
                </p>
                <p className="u-ui mt-0.5 font-semibold text-ink-1">{t("rfqPreviewTitle")}</p>
              </div>
              <span className="u-micro rounded-pill bg-primary-soft px-2 py-1 font-medium text-primary-ink">
                {t("rfqPreviewState")}
              </span>
            </div>
            <ul className="divide-y divide-hairline bg-surface-2">
              {previewLines.map((line, index) => (
                <li key={line.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="u-mono u-micro text-ink-3">{String(index + 1).padStart(2, "0")}</span>
                  <span className="u-meta min-w-0 flex-1 truncate font-medium text-ink-1">{line.name}</span>
                  <span className="u-micro shrink-0 text-ink-3">{t("rfqSetQuantity")}</span>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between border-t border-hairline px-4 py-2.5">
              <span className="u-meta text-ink-2">{t("rfqPreviewCount", { count: previewLines.length })}</span>
              <Link href="/b2b/rfq/new" className="u-focus u-meta rounded-nested font-medium text-primary-ink hover:underline">
                {t("rfqPreviewAction")}
              </Link>
            </div>
          </Surface>
        ) : null}
      </div>
    </section>
  );
}
