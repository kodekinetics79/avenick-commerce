"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, Search, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@avenick/utils";
import { useSearchSuggest } from "@/lib/search-suggest-client";
import type { SearchSuggestion, SuggestionKind } from "@/lib/search-suggest";

export interface HomeSearchCategory {
  slug: string;
  label: string;
}

export function HomeSearchDock({ categories }: { categories: HomeSearchCategory[] }) {
  const t = useTranslations("home");
  const locale = useLocale() === "ar" ? "ar" : "en";
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [query, setQuery] = React.useState("");
  const [isComposing, setIsComposing] = React.useState(false);
  const [suggestOpen, setSuggestOpen] = React.useState(false);
  const [activeSuggestion, setActiveSuggestion] = React.useState(-1);
  const listId = React.useId();
  const suggest = useSearchSuggest(isComposing ? "" : query, { limit: 6, debounceMs: 220 });
  const hasSuggestions = suggest.status === "ready" && suggest.suggestions.length > 0;
  const suggestionsVisible = suggestOpen && hasSuggestions;
  const emptyVisible =
    suggestOpen && query.trim().length >= 2 && suggest.status === "ready" && !hasSuggestions;

  const suggestionLabel = (suggestion: SearchSuggestion) =>
    locale === "ar" ? suggestion.labelAr || suggestion.label : suggestion.label;
  const parentLabel = (suggestion: SearchSuggestion) =>
    locale === "ar"
      ? suggestion.parent?.labelAr || suggestion.parent?.label
      : suggestion.parent?.label;
  const kindLabel = (kind: SuggestionKind) => {
    if (kind === "category") return t("searchSuggestionCategory");
    if (kind === "brand") return t("searchSuggestionBrand");
    return t("searchSuggestionProduct");
  };

  function clearSearch() {
    setQuery("");
    setSuggestOpen(false);
    setActiveSuggestion(-1);
    inputRef.current?.focus();
  }

  return (
    <div className="marketplace-search-dock" data-testid="home-search-dock">
      <form
        action="/search"
        method="get"
        role="search"
        className="marketplace-search-form"
        noValidate
      >
        <div className="marketplace-search-input">
          <label className="sr-only" htmlFor="marketplace-home-search">
            {t("searchLabel")}
          </label>
          <Search aria-hidden="true" className="h-5 w-5" />
          <input
            ref={inputRef}
            id="marketplace-home-search"
            type="search"
            name="q"
            placeholder={t("searchPlaceholder")}
            autoComplete="off"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSuggestOpen(true);
              setActiveSuggestion(-1);
            }}
            onFocus={() => setSuggestOpen(true)}
            onBlur={() => window.setTimeout(() => setSuggestOpen(false), 120)}
            onCompositionStart={() => setIsComposing(true)}
            onCompositionEnd={(event) => {
              setQuery(event.currentTarget.value);
              setIsComposing(false);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && event.nativeEvent.isComposing) {
                event.preventDefault();
                return;
              }
              if (!suggestionsVisible) return;
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActiveSuggestion((index) => Math.min(index + 1, suggest.suggestions.length - 1));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setActiveSuggestion((index) => Math.max(index - 1, -1));
              } else if (event.key === "Escape") {
                setSuggestOpen(false);
              } else if (event.key === "Enter" && activeSuggestion >= 0) {
                const selected = suggest.suggestions[activeSuggestion];
                if (!selected) return;
                event.preventDefault();
                router.push(selected.href);
              }
            }}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={suggestionsVisible}
            aria-controls={suggestionsVisible ? listId : undefined}
            aria-activedescendant={
              activeSuggestion >= 0 ? `${listId}-${activeSuggestion}` : undefined
            }
          />
          {query ? (
            <button
              type="button"
              className="marketplace-search-clear u-focus"
              onClick={clearSearch}
              aria-label={t("clearSearch")}
            >
              <X aria-hidden="true" className="h-4 w-4" />
            </button>
          ) : null}
          <span
            className="marketplace-search-progress"
            data-loading={suggest.status === "loading" ? "true" : "false"}
            aria-hidden="true"
          />

          {suggestionsVisible ? (
            <ul
              id={listId}
              role="listbox"
              aria-label={t("searchSuggestions")}
              className="marketplace-search-suggestions"
            >
              {suggest.suggestions.map((suggestion, index) => {
                const parent = parentLabel(suggestion);
                return (
                  <li
                    key={`${suggestion.kind}:${suggestion.href}`}
                    id={`${listId}-${index}`}
                    role="option"
                    aria-selected={index === activeSuggestion}
                  >
                    <Link
                      href={suggestion.href}
                      className={cn(
                        "marketplace-search-suggestion u-focus",
                        index === activeSuggestion && "is-active",
                      )}
                      onMouseDown={(event) => event.preventDefault()}
                    >
                      <span className="marketplace-search-suggestion-kind">
                        {kindLabel(suggestion.kind)}
                      </span>
                      <span className="marketplace-search-suggestion-name">
                        {parent ? <small>{parent} › </small> : null}
                        {suggestionLabel(suggestion)}
                      </span>
                      {suggestion.sku ? (
                        <span className="marketplace-search-suggestion-sku">{suggestion.sku}</span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : null}

          {emptyVisible ? (
            <div
              className="marketplace-search-suggestions marketplace-search-suggestions-empty"
              role="status"
            >
              {t("searchNoSuggestions")}
            </div>
          ) : null}
        </div>

        {/* This compact catalogue filter intentionally remains a native select:
            its platform-owned popup geometry is acceptable and gives mobile
            shoppers the familiar OS picker without duplicating listbox logic. */}
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

        <button type="submit" className="marketplace-search-submit u-shine">
          {t("searchAction")}
        </button>

        <Link href="/b2b/rfq/new" className="marketplace-search-rfq u-shine">
          <FileText aria-hidden="true" className="h-4 w-4" />
          {t("createRfq")}
        </Link>
      </form>

      <span className="sr-only" aria-live="polite">
        {suggest.status === "loading"
          ? t("searchLoading")
          : suggestionsVisible
            ? t("searchSuggestionCount", { count: suggest.suggestions.length })
            : ""}
      </span>

      <div className="marketplace-popular-searches" aria-label={t("popularSearches")}>
        <span>{t("popularSearches")}</span>
        <Link href="/search?q=cable">{t("popularCable")}</Link>
        <Link href="/search?q=safety%20equipment">{t("popularSafety")}</Link>
        <Link href="/search?q=electrical%20components">{t("popularElectrical")}</Link>
      </div>
    </div>
  );
}
