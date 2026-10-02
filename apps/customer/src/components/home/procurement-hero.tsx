import Image from "next/image";
import Link from "next/link";
import { ArrowRight, FileText, PackageSearch } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { HomeSearchDock, type HomeSearchCategory } from "./home-search-dock";
import { HeroMarketSignal } from "./hero-market-signal";
import type { MarketPulseItem } from "./market-pulse";

export interface ProcurementHeroItem {
  id: string;
  name: string;
  detail: string;
  imageUrl?: string;
}

export async function ProcurementHero({
  categories,
  rfqItems,
  pulseItems,
}: {
  categories: HomeSearchCategory[];
  rfqItems: ProcurementHeroItem[];
  pulseItems: MarketPulseItem[];
}) {
  const t = await getTranslations("home");
  const rows = rfqItems.slice(0, 3);

  return (
    <section className="marketplace-hero-shell" aria-labelledby="marketplace-hero-title">
      <div className="marketplace-hero-stage">
        <div className="marketplace-hero-visual" aria-hidden="true">
          <Image
            src="/hero/avenick-procurement-refinery.webp"
            alt=""
            fill
            priority
            sizes="100vw"
            className="marketplace-hero-image"
          />
        </div>

        <div className="marketplace-hero-copy">
          <p className="marketplace-kicker">{t("heroTagline")}</p>
          <h1 id="marketplace-hero-title" className="marketplace-hero-title">
            <span>{t("heroTitle1")}</span>
            <span>{t("heroTitle2")}</span>
          </h1>
          <p className="marketplace-hero-description">{t("heroDesc")}</p>
          <div className="marketplace-hero-actions">
            <Link href="/b2b/rfq/new" className="marketplace-hero-rfq u-focus u-shine">
              <FileText aria-hidden="true" className="h-5 w-5" />
              {t("createRfq")}
              <ArrowRight aria-hidden="true" className="h-5 w-5 rtl:rotate-180" />
            </Link>
            <Link href="/products" className="marketplace-editorial-link u-focus">
              {t("shopStockedProducts")}
              <ArrowRight aria-hidden="true" className="h-5 w-5 rtl:rotate-180" />
            </Link>
          </div>

          <HeroMarketSignal items={pulseItems} />
        </div>

        {rows.length > 0 && (
          <aside className="marketplace-rfq-example" aria-label={t("liveRfqExample")}>
            <div className="marketplace-rfq-heading">
              <div>
                <p>{t("liveRfqExample")}</p>
                <strong>{t("openForQuotes")}</strong>
              </div>
              <Link className="u-focus" href="/b2b/rfq/new">
                {t("viewAllRfqs")}
              </Link>
            </div>
            <div className="marketplace-rfq-meta">
              <span>{t("requiredBy")}</span>
              <span>{t("rfqItemCount", { count: rows.length })}</span>
            </div>
            <ul className="marketplace-rfq-table" aria-label={t("liveRfqExample")}>
              {rows.map((item) => (
                <li className="marketplace-rfq-row" key={item.id}>
                  <div className="marketplace-rfq-product">
                    {item.imageUrl ? (
                      <span className="marketplace-rfq-thumb">
                        <Image src={item.imageUrl} alt="" fill sizes="44px" />
                      </span>
                    ) : (
                      <span className="marketplace-rfq-thumb marketplace-rfq-thumb-empty">
                        <PackageSearch aria-hidden="true" className="h-4 w-4" />
                      </span>
                    )}
                    <span>
                      <strong>{item.name}</strong>
                      <small>{item.detail}</small>
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </aside>
        )}
      </div>

      <HomeSearchDock categories={categories} />
    </section>
  );
}
