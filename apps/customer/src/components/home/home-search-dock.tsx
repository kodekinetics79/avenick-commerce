"use client";

import Link from "next/link";
import { FileText, Search } from "lucide-react";
import { useTranslations } from "next-intl";

export interface HomeSearchCategory {
  slug: string;
  label: string;
}

export function HomeSearchDock({ categories }: { categories: HomeSearchCategory[] }) {
  const t = useTranslations("home");

  return (
    <div className="marketplace-search-dock" data-testid="home-search-dock">
      <form action="/search" method="get" role="search" className="marketplace-search-form">
        <label className="marketplace-search-input">
          <span className="sr-only">{t("searchLabel")}</span>
          <Search aria-hidden="true" className="h-5 w-5" />
          <input
            type="search"
            name="q"
            placeholder={t("searchPlaceholder")}
            autoComplete="off"
          />
        </label>

        <label className="marketplace-search-category">
          <span className="sr-only">{t("searchCategoryLabel")}</span>
          <select name="category" defaultValue="">
            <option value="">{t("searchAllCategories")}</option>
            {categories.map((category) => (
              <option key={category.slug} value={category.slug}>
                {category.label}
              </option>
            ))}
          </select>
        </label>

        <button type="submit" className="marketplace-search-submit">
          {t("searchAction")}
        </button>

        <Link href="/b2b/rfq/new" className="marketplace-search-rfq">
          <FileText aria-hidden="true" className="h-4 w-4" />
          {t("createRfq")}
        </Link>
      </form>

      <div className="marketplace-popular-searches" aria-label={t("popularSearches")}>
        <span>{t("popularSearches")}</span>
        <Link href="/search?q=cable">{t("popularCable")}</Link>
        <Link href="/search?q=safety%20equipment">{t("popularSafety")}</Link>
        <Link href="/search?q=electrical%20components">{t("popularElectrical")}</Link>
      </div>
    </div>
  );
}
