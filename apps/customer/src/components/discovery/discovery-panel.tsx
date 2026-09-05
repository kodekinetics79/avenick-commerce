"use client";

import * as React from "react";
import Link from "next/link";
import { Compass, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button, Eyebrow, ImageFrame, StatusPill, Surface } from "@avenick/ui";
import { useDisclosure } from "@/components/layout/disclosure";
import { storefrontProductHref } from "@/lib/product-card-commerce";
import {
  buildDiscoveryPlan,
  hasSomethingToSay,
  localeName,
  type DiscoveryBlock,
  type DiscoveryReason,
  type TrendingProduct,
  type ViewedProduct,
} from "./interest-signals";
import { isDismissed } from "./history-storage";
import { useCatalogueLabels, useDiscoverySignals } from "./use-discovery";

/**
 * THE DISCOVERY PANEL.
 *
 * It is a recommender, not an assistant. Nothing here reasons, converses or
 * predicts: every line on screen is a lookup over signals this browser recorded
 * about itself plus rows a server component handed down, and every suggestion
 * prints the exact signal that produced it. That is not a disclaimer bolted on
 * the bottom — the planner's types make a block without a stated reason
 * unrepresentable, so the sentence under each heading is the same value the
 * ranking used.
 *
 * WHAT IT REFUSES TO DO. It does not fill itself. With one product in the trail
 * it says so and stops; with none and no trending rows it does not render at
 * all, launcher included. There is no code path that reaches for an arbitrary
 * product to make the panel look busy, because a suggestion nobody can account
 * for is indistinguishable from a random product — and on a trade platform that
 * is not a small cost.
 *
 * MATERIAL. Rung 4 and OPAQUE. Rung 4 is where a floating layer belongs, but
 * this panel is nothing but body text, and text does not sit on a blur — the
 * same call the mega-menu makes two files away, for the same reason. The
 * storefront's blur budget is already spent on the header.
 *
 * BEHAVIOUR. It is a disclosure, not a dialog: it never traps focus and never
 * covers the page uninvited. Closed, it is one small pill in the corner, lifted
 * clear of the product page's mobile buy bar. It shares the header's
 * `useDisclosure`, which is what gives it Escape-to-close with focus returned to
 * the trigger, outside-click close, close-on-navigation, and a trigger that is a
 * real <button> reporting aria-expanded. There is no hover trigger, because a
 * keyboard or touch visitor never hovers.
 */

const PANEL_ID = "discovery-panel";

/**
 * A stable empty default. A fresh `[]` per render would invalidate the plan
 * memo on every paint, and the plan is what the whole panel is built from.
 */
const NO_TRENDING: TrendingProduct[] = [];

export interface DiscoveryPanelProps {
  /**
   * Rows from getTrendingProducts() in packages/database, passed down by a
   * server component — this is a client component and must never import the
   * catalogue service itself.
   *
   * EMPTY IS NORMAL, not an error: the signals service is entitled to say there
   * is not enough activity to rank anything, and the panel simply carries one
   * fewer block that day.
   */
  trending?: TrendingProduct[];
}

export function DiscoveryPanel({ trending = NO_TRENDING }: DiscoveryPanelProps) {
  const t = useTranslations("discovery");
  const locale = useLocale();
  const { ready, history, clear, dismissedAt, dismiss } = useDiscoverySignals();
  const { open, setOpen, rootProps, triggerProps } = useDisclosure(PANEL_ID);
  // The two small catalogue reads are issued when the panel is opened, not when
  // the page loads: a visitor who never opens it never pays for them.
  const labels = useCatalogueLabels(open);
  const headingId = `${PANEL_ID}-heading`;

  const plan = React.useMemo(
    () =>
      buildDiscoveryPlan({
        history,
        trending,
        now: Date.now(),
        categoryNames: labels.categoryNames,
        brandSlugs: labels.brandSlugs,
      }),
    [history, trending, labels],
  );

  const hidden = React.useMemo(() => isDismissed(dismissedAt, Date.now()), [dismissedAt]);
  // Anything at all recorded by this browser — a product opened, a category
  // browsed, a search run. Distinct from `basis.views`, because a visitor who
  // has only browsed categories still has a trail worth naming and clearing.
  const hasOwnSignal = plan.basis.views + plan.basis.categoryVisits + plan.basis.searches > 0;

  // Nothing renders until localStorage has been read, which also means the
  // server and the first client paint agree: both are empty.
  if (!ready || hidden || !hasSomethingToSay(plan)) return null;

  const closeAndReturnFocus = () => {
    setOpen(false);
    triggerProps.ref.current?.focus();
  };

  return (
    <div
      {...rootProps}
      className={[
        // z-sticky, deliberately BELOW the layer rung (50/51) that the
        // mega-menus, the account menu and the mobile drawer occupy. A passive
        // helper must never paint over a surface the visitor explicitly opened,
        // and it must never sit on a modal scrim.
        "fixed z-sticky end-4 print:hidden",
        // Clear of the product page's `fixed inset-x-0 bottom-0` buy bar below
        // lg, and of an iOS home indicator, so the helper never sits on top of
        // the one control the page exists for.
        "bottom-[calc(env(safe-area-inset-bottom,0px)+5.5rem)] lg:bottom-6",
      ].join(" ")}
    >
      {open && (
        <div className="mb-3 w-[min(23rem,calc(100vw-2rem))]">
          <Surface
            rung={4}
            id={PANEL_ID}
            role="region"
            aria-labelledby={headingId}
            className="u-pop flex max-h-[min(70vh,34rem)] flex-col overflow-hidden rounded-xl"
          >
            <div className="flex items-start gap-3 border-b border-hairline p-4 pb-3">
              <div className="min-w-0 flex-1">
                <Eyebrow className="mb-1">{t("eyebrow")}</Eyebrow>
                <h2 id={headingId} className="u-ui font-medium text-ink-1">
                  {hasOwnSignal ? t("heading.fromYourBrowsing") : t("heading.fromCatalogue")}
                </h2>
              </div>
              {plan.basis.views > 0 && (
                <StatusPill tone="neutral">{t("basis.views", { count: plan.basis.views })}</StatusPill>
              )}
              <button
                type="button"
                onClick={closeAndReturnFocus}
                aria-label={t("close")}
                className="u-focus -me-1 -mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-nested text-ink-3 transition-colors duration-hover ease-standard motion-reduce:transition-none hover:text-ink-1"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
              {plan.blocks.map((block) => (
                <BlockView key={blockKey(block)} block={block} locale={locale} />
              ))}

              {/* The honest empty-ish state. There IS a trail, it is simply too
                  thin to name a category or a brand from, and saying so is the
                  only alternative to inventing one. */}
              {plan.needsMoreSignal && (
                <p className="u-meta rounded-nested bg-surface-1 p-3 text-ink-3">{t("needsMoreSignal")}</p>
              )}
              {!hasOwnSignal && <p className="u-meta text-ink-3">{t("noSignal")}</p>}
            </div>

            <div className="space-y-2 border-t border-hairline p-4 pt-3">
              <p className="u-meta text-ink-3">{t("basis.local")}</p>
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="ghost" size="xs" onClick={clear} disabled={!hasOwnSignal}>
                  {t("actions.clear")}
                </Button>
                <Button type="button" variant="ghost" size="xs" onClick={dismiss}>
                  {t("actions.hide")}
                </Button>
              </div>
            </div>
          </Surface>
        </div>
      )}

      <Button {...triggerProps} variant="secondary" size="sm" className="shadow-elev-3">
        <Compass className="h-4 w-4" aria-hidden="true" />
        {t("launcher")}
      </Button>
    </div>
  );
}

function blockKey(block: DiscoveryBlock): string {
  return block.kind === "categoryJump" || block.kind === "brandJump" ? `${block.kind}:${block.slug}` : block.kind;
}

function BlockView({ block, locale }: { block: DiscoveryBlock; locale: string }) {
  const t = useTranslations("discovery");

  switch (block.kind) {
    case "recentlyViewed":
      return (
        <section>
          <Eyebrow as="h3" className="mb-1">{t("blocks.recentlyViewed")}</Eyebrow>
          <Reason reason={block.reason} locale={locale} />
          <ul className="mt-2 space-y-0.5">
            {block.products.map((product) => (
              <li key={product.id}>
                <ProductRow product={product} locale={locale} />
              </li>
            ))}
          </ul>
        </section>
      );

    case "categoryJump": {
      const category = localeName(block.name, locale);
      return (
        <section>
          <Eyebrow as="h3" className="mb-1">{t("blocks.moreIn", { category })}</Eyebrow>
          <Reason reason={block.reason} locale={locale} />
          <div className="mt-2 flex flex-wrap gap-2">
            <Button asChild variant="secondary" size="xs">
              <Link href={block.href}>{t("actions.browseCategory", { category })}</Link>
            </Button>
            {/* The smart jump: the same category with the catalogue's own
                in-stock filter already applied. */}
            <Button asChild variant="ghost" size="xs">
              <Link href={block.inStockHref}>{t("actions.inStockOnly")}</Link>
            </Button>
          </div>
        </section>
      );
    }

    case "brandJump": {
      const brand = localeName(block.name, locale);
      return (
        <section>
          <Eyebrow as="h3" className="mb-1">{t("blocks.moreFrom", { brand })}</Eyebrow>
          <Reason reason={block.reason} locale={locale} />
          <div className="mt-2">
            <Button asChild variant="secondary" size="xs">
              <Link href={block.href}>{t("actions.browseBrand", { brand })}</Link>
            </Button>
          </div>
        </section>
      );
    }

    case "resumeSearch":
      return (
        <section>
          <Eyebrow as="h3" className="mb-1">{t("blocks.resumeSearch")}</Eyebrow>
          <Reason reason={block.reason} locale={locale} />
          <div className="mt-2">
            <Button asChild variant="ghost" size="xs">
              <Link href={block.href}>{t("actions.runSearch", { term: block.term })}</Link>
            </Button>
          </div>
        </section>
      );

    case "trending":
      return (
        <section>
          <Eyebrow as="h3" className="mb-1">{t("blocks.trending")}</Eyebrow>
          <Reason reason={block.reason} locale={locale} />
          <ul className="mt-2 space-y-0.5">
            {block.products.map((product) => (
              <li key={product.id}>
                <ProductRow product={toRow(product)} locale={locale} />
              </li>
            ))}
          </ul>
        </section>
      );
  }
}

/**
 * The stated basis for a block, in the visitor's own terms.
 *
 * Every branch is a literal message key so the repository's message-key
 * regression scan can see it. A reason assembled from a variable key would pass
 * typecheck, pass lint, and take the page out at runtime in the language nobody
 * ran locally — which is precisely the failure that scan exists for.
 */
function Reason({ reason, locale }: { reason: DiscoveryReason; locale: string }) {
  const t = useTranslations("discovery");
  const text = (() => {
    switch (reason.kind) {
      case "recentViews":
        return t("reason.recentViews", { count: reason.count });
      case "categoryBrowsed":
        return t("reason.categoryBrowsed", { category: localeName(reason.category, locale), count: reason.count });
      case "categoryViewed":
        return t("reason.categoryViewed", { category: localeName(reason.category, locale), count: reason.count });
      case "categoryBoth":
        return t("reason.categoryBoth", {
          category: localeName(reason.category, locale),
          browseCount: reason.browseCount,
          viewCount: reason.viewCount,
        });
      case "brandViewed":
        return t("reason.brandViewed", { brand: localeName(reason.brand, locale), count: reason.count });
      case "lastSearch":
        return t("reason.lastSearch", { term: reason.term });
      case "catalogueActivity":
        return t("reason.catalogueActivity");
    }
  })();
  return <p className="u-meta text-ink-3">{text}</p>;
}

/** A trending row rendered through the same component the local trail uses. */
function toRow(product: TrendingProduct): ViewedProduct {
  return {
    id: product.id,
    slug: product.slug,
    name: { en: product.nameEn, ar: product.nameAr ?? null },
    imageUrl: product.images?.[0]?.url ?? null,
    sku: product.sku ?? null,
    brand: product.brand ? { en: product.brand.nameEn, ar: product.brand.nameAr ?? null } : null,
    category: product.category ? { slug: product.category.slug, name: { en: product.category.nameEn, ar: product.category.nameAr ?? null } } : null,
    at: 0,
  };
}

function ProductRow({ product, locale }: { product: ViewedProduct; locale: string }) {
  const name = localeName(product.name, locale);
  const secondary = product.brand ? localeName(product.brand, locale) : product.category ? localeName(product.category.name, locale) : null;
  return (
    <Link
      href={storefrontProductHref(product.slug)}
      className="u-focus flex items-center gap-3 rounded-nested p-1.5 transition-colors duration-hover ease-standard motion-reduce:transition-none hover:bg-ink-1/[0.05]"
    >
      {/* The catalogue's own frame, so an unphotographed listing — most of them —
          gets the designed plate and its SKU rather than a broken tile. */}
      <ImageFrame
        src={product.imageUrl}
        alt={product.imageUrl ? name : ""}
        sku={product.sku ?? undefined}
        className="w-11 shrink-0 overflow-hidden rounded-sm"
      />
      <span className="min-w-0 flex-1">
        <span className="u-ui block truncate text-ink-1">{name}</span>
        {secondary && <span className="u-meta block truncate text-ink-3">{secondary}</span>}
      </span>
    </Link>
  );
}
