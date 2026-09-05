"use client";

import { notFound } from "next/navigation";
import Link from "next/link";
import * as React from "react";
import { useState, useEffect, useCallback, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ProductCard } from "@/components/products/product-card";
import { ProductGrid } from "@/components/products/product-grid";
import { toCardRow } from "@/lib/product-card-row";
import { useCartDrawerStore } from "@/components/cart/cart-drawer-store";
import { ChevronRight, FileText, Heart, RotateCcw, ShieldCheck, Truck } from "lucide-react";
import {
  AvailabilityDot,
  Button,
  CellGrid,
  CommitLabel,
  Dateline,
  Divider,
  Eyebrow,
  PriceStack,
  Skeleton,
  SkeletonImageFrame,
  SkeletonLadder,
  StatusPill,
  Surface,
  type StockState,
} from "@avenick/ui";
import { formatCurrency } from "@avenick/utils";
import { MainLayout } from "@/components/layout/main-layout";
import { useCartStore } from "@/stores/cart";
import { useWishlist } from "@/stores/wishlist";
import {
  resolveStorefrontSelection,
  toStorefrontCartLine,
  toStorefrontWishlistItem,
  type StorefrontProduct,
} from "@/lib/catalog-commercial";
import { defaultStorefrontCurrency, type Currency } from "@/lib/market-context";
import { BuyActions } from "@/components/product/buy-actions";
import { PricePanel } from "@/components/product/price-panel";
import { ProductGallery, type GalleryImage } from "@/components/product/product-gallery";
import { ReviewPanel, type Review, type ReviewAccess } from "@/components/product/review-panel";
import { SellerCard, type ProductSeller } from "@/components/product/seller-card";
import { SpecList, type SpecRow } from "@/components/product/spec-list";
import { ViewBeacon } from "@/components/product/view-beacon";
import { attributeLabel, buildPriceLadder, BUTTON_TYPE, FOCUS_INSET } from "@/components/product/product-facts";
import type { SubmittedReview } from "@/components/product/review-form";
import { Stars } from "@/components/product/stars";

type Section = "description" | "specs" | "reviews" | "shipping";

/**
 * THE PRODUCT DETAIL PAGE — the highest-intent surface in the storefront.
 *
 * THE COMPOSITION. Round one set this page as two equal 50/50 columns of
 * equally-weighted cards, which is a system with no range: the photograph, the
 * price, the supplier and three lines of assurance copy all occupied boxes
 * within one order of magnitude of each other, so nothing led and nothing
 * receded. It is now a twelve-column asymmetric composition — seven columns of
 * framed photography against five of buy column — with ONE raised object in the
 * viewport (the price panel at rung 3, the only rung 3 on the page) and one
 * enormous figure in it. `grid-column` is logical, so the whole composition
 * mirrors in Arabic with no second rule.
 *
 * WHAT WAS ACTUALLY WRONG, in order of how much it cost:
 *
 *   1. EVERY user-visible string was an English literal in JSX — roughly ninety
 *      of them, on a page an Arabic buyer reaches from an Arabic header. That is
 *      not a translation gap, it is the product announcing that Arabic is a
 *      setting rather than a design. Every string now comes from the `pdp`
 *      namespace of the next-intl tree.
 *   2. `aspect-square` + `object-cover` on seller-supplied photography, in the
 *      gallery AND in every thumbnail. See <ProductGallery>.
 *   3. The gallery threw away the supplier's own `altEn`/`altAr` and substituted
 *      the product name on every frame.
 *   4. The product name was `nameEn` in both locales, so the Arabic build showed
 *      an English headline with an Arabic subtitle under it.
 *   5. The consumer price was displayed VAT-EXCLUSIVE, which is the opposite of
 *      what UAE FTA rules require of a consumer-facing price. See <PricePanel>.
 *   6. `formatCurrency` was called without a locale, so an Arabic buyer read
 *      Latin currency codes while the product tiles beside them did not.
 *
 * The page is a client component because it always has been: it fetches the
 * product, the review eligibility and the reviews on the client, and law 8
 * forbids ADDING "use client" to get an animation, not keeping an architecture
 * that predates this round. No fetch, no server action, no permission check and
 * no validation is touched here.
 */
export default function ProductPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { currency?: string; b2b?: string; variantId?: string; qty?: string };
}) {
  const t = useTranslations("pdp");
  const locale = useLocale() as "en" | "ar";

  const [product, setProduct] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);
  const [section, setSection] = useState<Section>("description");
  const [selectedVariantId, setSelectedVariantId] = useState<string>();
  const [reviewAccess, setReviewAccess] = useState<ReviewAccess>({ state: "loading" });
  // The quantity that was actually added, not a boolean. The announcement names
  // a figure, and a buyer who nudges the stepper during the 2.4s confirmation
  // window would otherwise hear a number that was never sent to the cart.
  const [added, setAdded] = useState<number | null>(null);
  // Increments on every successful add so <CommitBadge> re-keys and the pulse
  // restarts. A CSS animation restarts from zero only if the element remounts,
  // so a buyer pressing four times quickly gets four pulses rather than one
  // stuck at frame zero.
  const [addedToken, setAddedToken] = useState(0);
  // The mobile buy bar starts hidden and the observer reveals it. It duplicates a
  // control that is always in the document, so a browser that never runs the
  // effect loses nothing — unlike content, a duplicate action may default to off.
  const [buyBoxOffScreen, setBuyBoxOffScreen] = useState(false);
  // ...and it stands down again at the foot of the page, or it would sit on top
  // of the last 70px of the footer with nothing left to scroll.
  const [atPageEnd, setAtPageEnd] = useState(false);
  const buyBarVisible = buyBoxOffScreen && !atPageEnd;
  const buyBoxRef = useRef<HTMLDivElement>(null);
  const pageEndRef = useRef<HTMLDivElement>(null);
  const addedTimer = useRef<ReturnType<typeof setTimeout>>();
  const addItem = useCartStore((s) => s.addItem);
  const { toggle, has } = useWishlist();

  /**
   * Which section the reader is in, for the section nav's aria-current and its
   * drawn rule. An IntersectionObserver rather than a scroll listener: the old
   * handler ran on every frame of every scroll and read `offsetTop` off four
   * elements each time, which forces a layout for a value that changes four
   * times on the whole page. The nav is plain anchors, so this is presentation
   * only — navigation still works with the observer never firing.
   */
  useEffect(() => {
    const ids: Section[] = ["description", "specs", "reviews", "shipping"];
    const sections = ids.map((id) => document.getElementById(id)).filter((el): el is HTMLElement => el !== null);
    if (sections.length === 0 || typeof IntersectionObserver === "undefined") return;
    const onScreen = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) onScreen.add(entry.target.id);
          else onScreen.delete(entry.target.id);
        }
        const first = ids.find((id) => onScreen.has(id));
        if (first) setSection(first);
      },
      // Top inset clears the page header and the sticky section nav; the bottom
      // inset stops a section counting as "current" while it is only just
      // peeking in from below.
      { rootMargin: "-130px 0px -55% 0px", threshold: 0 },
    );
    for (const el of sections) observer.observe(el);
    return () => observer.disconnect();
  }, [product]);

  /**
   * Reveals the mobile buy bar once the real buy box has left the viewport, and
   * withdraws it again once the end of the page is in view so the footer is
   * never permanently covered by it.
   */
  useEffect(() => {
    const box = buyBoxRef.current;
    const end = pageEndRef.current;
    if (!box || !end || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.target === box) setBuyBoxOffScreen(!entry.isIntersecting);
          else setAtPageEnd(entry.isIntersecting);
        }
      },
      { threshold: 0 },
    );
    observer.observe(box);
    observer.observe(end);
    return () => observer.disconnect();
  }, [product]);

  useEffect(() => () => clearTimeout(addedTimer.current), []);

  const productUrl = useCallback((extra: Record<string, string> = {}) => {
    const currency = searchParams.currency?.toUpperCase();
    const query = new URLSearchParams({
      ...(currency ? { currency } : {}),
      ...(searchParams.b2b === "true" ? { b2b: "true" } : {}),
      ...extra,
    });
    return `/api/products/${params.slug}${query.size ? `?${query}` : ""}`;
  }, [params.slug, searchParams.currency, searchParams.b2b]);

  /*
    The selling rails, fetched alongside the product rather than with it: the
    product answers in one round trip and paints; the rails answer in another
    and appear below the fold. A buyer never waits on "others also bought" to
    read a spec sheet. Each list is empty when its signal is thin — bought
    together needs real co-purchases, trending needs real views — and an empty
    list renders NOTHING, never a padded rail under a confident heading.
  */
  const [rails, setRails] = useState<{ related: any[]; boughtTogether: any[]; trending: any[] } | null>(null);
  useEffect(() => {
    let cancelled = false;
    const url = productUrl().replace(`/api/products/${params.slug}`, `/api/products/${params.slug}/recommendations`);
    fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (!cancelled && data?.success) setRails(data.data); })
      .catch(() => { /* a missing rail is a missing rail, not a broken page */ });
    return () => { cancelled = true; };
  }, [productUrl, params.slug]);

  useEffect(() => {
    fetch(productUrl())
      .then((r) => r.json())
      .then((data) => {
        setProduct(data.data);
        setLoading(false);
        if (data.data) {
          const requestedQty = Number(searchParams.qty);
          setQty(Number.isInteger(requestedQty) && requestedQty >= (data.data.moq ?? 1) ? requestedQty : data.data.moq ?? 1);
          const variants = data.data.variants ?? [];
          setSelectedVariantId(variants.some((variant: { id: string }) => variant.id === searchParams.variantId)
            ? searchParams.variantId : variants.find((variant: { inStock: boolean }) => variant.inStock)?.id ?? variants[0]?.id);
        }
      })
      .catch(() => setLoading(false));
  }, [productUrl, searchParams.variantId, searchParams.qty]);

  useEffect(() => {
    let cancelled = false;
    setReviewAccess({ state: "loading" });
    fetch(`/api/products/${encodeURIComponent(params.slug)}/reviews/eligibility`)
      .then(async (r) => ({ ok: r.ok, payload: await r.json().catch(() => null) }))
      .then(({ ok, payload }) => {
        if (cancelled) return;
        if (ok && payload?.success && payload.data) setReviewAccess({ state: "ready", ...payload.data });
        else if (!ok && typeof payload?.error === "string") setReviewAccess({ state: "blocked", message: payload.error });
        else setReviewAccess({ state: "unknown" });
      })
      .catch(() => { if (!cancelled) setReviewAccess({ state: "unknown" }); });
    return () => { cancelled = true; };
  }, [params.slug]);

  /**
   * After a review is stored, re-read the product so the list and the average
   * come from the server. The public product response is edge-cached for a
   * minute, so the refetch carries the new review id as a cache key; if the
   * cached copy still wins, the stored review is merged in from the POST
   * response rather than pretending it was not saved.
   */
  const onReviewSubmitted = useCallback(async (review: SubmittedReview) => {
    setReviewAccess({ state: "ready", eligible: false, reason: "already-reviewed" });
    const mine: Review = { ...review, mine: true };
    // Merging the stored review into a copy the server produced BEFORE it
    // existed: the list gains a row, so the server's total must gain one too,
    // or the section label and the rating row disagree with the list by exactly
    // one. When the server sent no total the page counts the list itself.
    const withMine = <T extends Record<string, unknown> & { reviews?: Review[]; reviewTotal?: unknown }>(source: T): T => ({
      ...source,
      reviews: [mine, ...(source.reviews ?? [])],
      ...(typeof source.reviewTotal === "number" ? { reviewTotal: source.reviewTotal + 1 } : {}),
    });
    const data = await fetch(productUrl({ reviewed: review.id })).then((r) => r.json()).catch(() => null);
    const fresh = data?.data as (Record<string, unknown> & { reviews?: Review[] }) | undefined;
    if (fresh) {
      const listed = (fresh.reviews ?? []).some((r) => r.id === review.id);
      setProduct(listed ? fresh : withMine(fresh));
      return;
    }
    // The refetch failed or was refused; the review is stored regardless, so
    // it is shown from the POST response rather than vanishing after submit.
    setProduct((current) => current ? withMine(current as Record<string, unknown> & { reviews?: Review[] }) : current);
  }, [productUrl]);

  // A skeleton has to occupy the same box as the thing it replaces, or the page
  // jumps when the data lands. These shapes match the twelve-column composition
  // below — the frame at its own ratio, the ladder at its own metrics — rather
  // than four generic grey bars. A page that assembles itself in front of you
  // cannot look expensive no matter what it assembles into.
  if (loading) return (
    <MainLayout>
      <div className="mx-auto max-w-shell px-gutter py-8">
        <Skeleton className="mb-6 h-4 w-48" />
        <div className="grid grid-cols-1 items-start gap-x-8 gap-y-8 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <SkeletonImageFrame />
            <div className="mt-stack flex gap-2">
              {[0, 1, 2, 3].map((i) => <SkeletonImageFrame key={i} className="w-16 shrink-0" />)}
            </div>
          </div>
          <div className="space-y-5 lg:col-span-5 lg:col-start-8">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-10 w-4/5" />
            <Skeleton className="h-4 w-1/2" />
            <Surface rung={3} rim className="space-y-4 p-5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-12 w-40" />
              <SkeletonLadder />
              <Skeleton className="h-control-lg w-full" />
            </Surface>
          </div>
        </div>
      </div>
    </MainLayout>
  );

  if (!product) return notFound();

  const p = product as Record<string, unknown> & StorefrontProduct;
  const images = ((p.images as GalleryImage[]) ?? []).filter((image) => !!image?.url);
  const variants = p.variants ?? [];
  const isB2B = searchParams.b2b === "true";
  const selection = resolveStorefrontSelection(p, selectedVariantId, qty, searchParams.currency?.toUpperCase() ?? defaultStorefrontCurrency());
  const seller = p.seller as ProductSeller | undefined;
  const brand = p.brand as { nameEn?: string; nameAr?: string | null } | null | undefined;
  const inStock = selection?.inStock === true;
  const selectedVariant = variants.find((variant) => variant.id === selectedVariantId);
  const availability = (selectedVariant?.availabilityStatus
    ?? p.inventory[0]?.status
    ?? (inStock ? "IN_STOCK" : "OUT_OF_STOCK")) as StockState;
  const displayCurrency = (selection?.currency ?? defaultStorefrontCurrency()) as Currency;
  const productId = String(p.id);
  const wishlisted = has(productId, selection?.variantId);
  // More than one active price band in the resolved currency — on the variant
  // or on the product it falls back to — means the unit price depends on the
  // quantity. The cart records this so a later quantity change comes back here
  // to be repriced instead of being edited against a tier that may no longer apply.
  const priceTiered = selection
    ? [...(selectedVariant?.prices ?? []), ...p.prices].filter((price) => price.currency === selection.currency).length > 1
    : false;
  const moq = Math.max(1, Number(p.moq) || 1);
  const ladder = selection ? buildPriceLadder(p, selectedVariantId, selection.currency, moq) : [];

  // The product's own name in the reader's own language, with the other language
  // carried beneath it. The previous version pinned the headline to nameEn in
  // both builds, so the Arabic page opened with an English title.
  const nameEn = String(p.nameEn ?? "");
  const nameAr = p.nameAr ? String(p.nameAr) : "";
  const primaryName = locale === "ar" ? nameAr || nameEn : nameEn;
  const secondaryName = locale === "ar" ? (nameAr ? nameEn : "") : nameAr;
  const brandName = brand ? (locale === "ar" ? brand.nameAr || brand.nameEn : brand.nameEn) : null;

  const reviews = (p.reviews as Review[]) ?? [];
  const reviewCount = reviews.length;
  // The catalog returns the most recent reviews, not the full history. The
  // headline count is the server's total when it sends one; without it the
  // page can only count what it was given, and says so ("recent").
  const reviewTotalKnown = typeof p.reviewTotal === "number";
  const reviewTotal = reviewTotalKnown ? (p.reviewTotal as number) : reviewCount;
  const avgRating = reviewCount > 0 ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviewCount) * 10) / 10 : null;
  // The catalogue returns at most twenty reviews and reports the true total
  // separately, so the average above is over the WINDOW, not over the total.
  // Printing "4.6" beside "45 reviews" states an average that was never
  // computed — a truth failure delivered by two facts that are each true on
  // their own. Whenever the window is a subset, the figure is labelled with the
  // count it is actually averaged over, which is the same basis the reviews
  // section prints in full underneath.
  const averageIsPartial = !reviewTotalKnown || reviewTotal > reviewCount;
  const averageBasisCount = averageIsPartial ? reviewCount : reviewTotal;

  const skuText = selection?.sku ?? String(p.sku);
  const rfqHref = seller
    ? `/b2b/rfq/new?supplier=${encodeURIComponent(String(seller.id ?? ""))}&product=${encodeURIComponent(productId)}`
    : null;

  const SECTIONS: { id: Section; label: string }[] = [
    { id: "description", label: t("sections.description") },
    { id: "specs", label: t("sections.specs") },
    { id: "reviews", label: `${t("sections.reviews")} (${reviewTotal})` },
    { id: "shipping", label: t("sections.shipping") },
  ];

  const specRows: SpecRow[] = [
    { label: t("specs.sku"), value: skuText, mono: true },
    { label: t("specs.brand"), value: brandName || null },
    { label: t("specs.origin"), value: p.origin ? String(p.origin) : null },
    { label: t("specs.weight"), value: p.weight ? t("specs.weightValue", { value: String(p.weight) }) : null },
    { label: t("specs.moq"), value: t("price.unitsValue", { qty: moq }) },
    { label: t("specs.consumerOrders"), value: p.isB2CEnabled ? t("specs.available") : t("specs.unavailable") },
    { label: t("specs.businessOrders"), value: p.isB2BEnabled ? t("specs.available") : t("specs.unavailable") },
    // The selected variant's own attributes: before this they appeared only
    // squeezed into the chooser's subtitle.
    ...Object.entries((selectedVariant?.attributes ?? {}) as Record<string, unknown>)
      .map(([key, value]) => ({ label: attributeLabel(key), value: String(value) })),
  ];

  const addToCart = () => {
    if (!selection) return;
    addItem({ ...toStorefrontCartLine(p, selection, qty, isB2B ? "B2B" : "B2C", images[0]?.url), priceTiered });
    // The same drawer the catalogue tiles open: the buyer sees the line they
    // just added, the running subtotal, and stays on the product page. The
    // page's own "Added" readout below is kept — it confirms the click on the
    // control the buyer is looking at; the drawer is where they go next.
    useCartDrawerStore.getState().openFor({
      productId: String(p.id),
      ...(selection?.variantId ? { variantId: selection.variantId } : {}),
    });
    // The line is already in the cart by the time this runs: the confirmation is
    // a READOUT, never a gate. The control stays enabled and a second press
    // simply restarts the acknowledgement from wherever it is.
    setAdded(qty);
    setAddedToken((token) => token + 1);
    clearTimeout(addedTimer.current);
    addedTimer.current = setTimeout(() => setAdded(null), 2400);
  };

  const buyActions = (
    <BuyActions
      qty={qty}
      moq={moq}
      maxQty={selection?.availableQty ?? 0}
      canBuy={!!selection}
      inStock={inStock}
      added={added}
      addedToken={addedToken}
      onQty={setQty}
      onAdd={addToCart}
      requestAvailabilityHref={rfqHref}
    />
  );

  return (
    <MainLayout>
      {/* The one input the Trending rail has. Renders nothing; see ViewBeacon.
          The id is narrowed rather than cast: this page's product comes from an
          untyped fetch, and a cast here would send `undefined` to the beacon as
          a string on any shape change, quietly poisoning the signal table with
          rows the FK would then reject. */}
      {typeof product.id === "string" && product.id ? <ViewBeacon productId={product.id} /> : null}
      {/* Bottom padding leaves room for the mobile buy bar, which is fixed. */}
      <div className="min-h-screen bg-background pb-24 lg:pb-0">
        <div className="mx-auto max-w-shell px-gutter py-8">

          <nav aria-label={t("breadcrumbLabel")} className="mb-6">
            <ol className="flex items-center gap-1.5 u-meta text-ink-3">
              <li><Link href="/" className="u-focus rounded-sm hover:text-ink-1">{t("home")}</Link></li>
              {/* A chevron implies a reading direction, so it flips in Arabic. */}
              <li aria-hidden="true"><ChevronRight className="h-3 w-3 rtl:rotate-180" /></li>
              <li><Link href="/products" className="u-focus rounded-sm hover:text-ink-1">{t("allProducts")}</Link></li>
              <li aria-hidden="true"><ChevronRight className="h-3 w-3 rtl:rotate-180" /></li>
              <li className="min-w-0"><span aria-current="page" className="block truncate font-medium text-ink-1">{primaryName}</span></li>
            </ol>
          </nav>

          {/*
            Six columns of framed photography, an empty gutter column, five of
            buy column. grid-column and grid-column-start are LOGICAL, so the
            whole composition mirrors in Arabic with no second rule, and
            `items-start` keeps the two columns independent rather than
            stretching the shorter one to match the taller.
          */}
          <div className="grid grid-cols-1 items-start gap-x-8 gap-y-8 lg:grid-cols-12">
            <div className="lg:col-span-6">
              <ProductGallery
                images={images}
                productName={primaryName}
                sku={skuText}
                availability={availability}
                availabilityLabel={t(`availability.${availability}`)}
                locale={locale}
              />
            </div>

            {/* Column seven is deliberately empty. An even 6/6 split reads as two
                halves of a document; six columns of photography, a gutter, and
                five of buy column reads as a composition, and the asymmetry is
                what tells the eye which side leads. col-start is logical, so this
                mirrors in Arabic with no second rule. */}
            <div className="space-y-5 lg:col-span-5 lg:col-start-8">
              {/* Identity */}
              <div>
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    {!!brandName && <Eyebrow tone="primary" className="mb-1.5">{brandName}</Eyebrow>}
                    {/* text-wrap: balance comes from the h1 rule, so a long
                        supplier title never leaves a single word on its own last
                        line — the loudest amateur tell in a large headline. */}
                    <h1 className="u-h1 text-ink-1">{primaryName}</h1>
                    {!!secondaryName && (
                      <p className="u-lead mt-1 text-ink-2" dir={locale === "ar" ? "ltr" : "rtl"}>{secondaryName}</p>
                    )}
                  </div>
                  <Button
                    variant={wishlisted ? "secondary" : "ghost"}
                    size="icon"
                    className="shrink-0"
                    disabled={!selection}
                    aria-label={wishlisted ? t("wishlistRemove") : t("wishlistAdd")}
                    aria-pressed={wishlisted}
                    onClick={() => selection && toggle({ ...toStorefrontWishlistItem(p, params.slug, selection, qty, isB2B ? "B2B" : "B2C", images[0]?.url), priceTiered })}
                  >
                    {/* An icon-only control never carries meaning in the glyph
                        alone: the accessible name is on the button above, and the
                        filled state is one class rather than a second icon. */}
                    <Heart className={`h-5 w-5 ${wishlisted ? "fill-current text-danger-ink" : ""}`} aria-hidden="true" />
                  </Button>
                </div>

                {/* The fact row. SKU is a first-class comparison attribute for a
                    procurement audience and it is set in mono, because a
                    reference is read character by character. The rating link
                    appears only when there is a rating: a repeated "No reviews
                    yet" turns the loudest signal on the page into absence. */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  {/* The same dot the seller's inventory table and the admin
                      stock console show, with the state carried in words beside
                      it — colour is never the only channel. It appears here and
                      under the frame it desaturates, because those are the two
                      things it governs and they are in two different columns. */}
                  <AvailabilityDot state={availability} label={t(`availability.${availability}`)} />
                  <span className="u-meta text-ink-3">
                    {t("sku")} <span className="u-mono text-ink-2">{skuText}</span>
                  </span>
                  {!!p.origin && (
                    <span className="u-meta text-ink-3">
                      {t("origin")} <span className="text-ink-2">{String(p.origin)}</span>
                    </span>
                  )}
                  {avgRating != null && (
                    <a
                      href="#reviews"
                      className="u-focus inline-flex items-center gap-2 rounded-sm"
                      aria-label={t("reviews.averageAria", { value: avgRating, count: averageBasisCount })}
                    >
                      <Stars value={avgRating} className="h-3.5 w-3.5" />
                      <span className="fig u-ui font-medium text-ink-1">{avgRating}</span>
                      <span className="u-meta text-ink-3 underline-offset-4 hover:underline" aria-hidden="true">
                        {averageIsPartial
                          ? t("reviews.countRecent", { count: averageBasisCount })
                          : t("reviews.count", { count: averageBasisCount })}
                      </span>
                    </a>
                  )}
                </div>

                {!!p.isB2BEnabled && (
                  <div className="mt-3">
                    <StatusPill tone="accent">{t("businessOrders")}</StatusPill>
                  </div>
                )}
              </div>

              {variants.length > 0 && (
                <div>
                  <Eyebrow id="variant-group-label" className="mb-2">{t("variantLabel")}</Eyebrow>
                  <div role="group" aria-labelledby="variant-group-label" className="flex flex-wrap gap-2">
                    {variants.map((variant) => {
                      const active = selectedVariantId === variant.id;
                      const attributes = Object.entries((variant.attributes ?? {}) as Record<string, unknown>)
                        .map(([key, value]) => `${attributeLabel(key)} ${String(value)}`).join(" · ");
                      return (
                        // A chooser is an input, so an unchosen option is recessed
                        // and the chosen one lifts out of the well. The brass rule
                        // draws itself in from the inline start — the same active
                        // mark the nav, the ladder's active band and the empty
                        // certificate use, so selection reads the same everywhere.
                        // The selected edge is a border rather than a ring:
                        // Tailwind's ring-* utilities emit a box-shadow, which
                        // would replace the rung's elevation shadow outright and
                        // flatten the ladder.
                        <Surface
                          key={variant.id}
                          as="button"
                          {...BUTTON_TYPE}
                          rung={active ? 2 : 1}
                          lift={!active}
                          focusLift
                          aria-pressed={active}
                          onClick={() => setSelectedVariantId(variant.id)}
                          className={`relative overflow-hidden px-3 py-2 pb-2.5 text-start ${active ? "border-primary/60" : ""}`}
                        >
                          <span className="block u-ui font-medium text-ink-1">
                            {locale === "ar" ? variant.nameAr || variant.nameEn : variant.nameEn}
                          </span>
                          <span className="block u-meta text-ink-3">{attributes || variant.sku}</span>
                          {!variant.inStock && (
                            <AvailabilityDot
                              state="OUT_OF_STOCK"
                              label={t("variantOutOfStock")}
                              className="mt-1.5"
                            />
                          )}
                          <Divider drawn on={active} className="absolute inset-x-0 bottom-0" />
                        </Surface>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* The one raised object in the viewport: price, ladder and commit
                  as a single instrument rather than three stacked cards. */}
              <div ref={buyBoxRef}>
                <PricePanel
                  selection={selection}
                  currency={displayCurrency}
                  locale={locale}
                  qty={qty}
                  moq={moq}
                  isB2B={isB2B}
                  ladder={ladder}
                  onSetQty={setQty}
                >
                  {buyActions}
                </PricePanel>
              </div>

              {/*
                Every claim here is backed by an implemented rule. "Verified
                Supplier" was once asserted for every seller regardless of tier —
                the real tier is rendered on the supplier card below. "14-day
                returns" named a window that exists nowhere in the schema or the
                services. And "Delivery quoted at checkout", which survived round
                one, named a mechanism that does not exist either: nothing in the
                cart, the checkout or the order API computes or presents a
                delivery figure — `Order.shippingAmount` is written by no code
                path in this repository and defaults to zero. The line now says
                only what the shipping section below already says, which is what
                order processing actually does. One hairline-divided panel rather
                than three bordered tiles, and the icons carry no hue: ten
                colours saying nothing is the loudest amateur signal there is.
              */}
              <CellGrid cols={{ base: 1, sm: 3 }} density="compact">
                <div className="flex items-start gap-2 text-start">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" aria-hidden="true" />
                  <span className="u-meta text-ink-2">{t("assurance.priceChecked")}</span>
                </div>
                <div className="flex items-start gap-2 text-start">
                  <Truck className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" aria-hidden="true" />
                  <span className="u-meta text-ink-2">{t("assurance.delivery")}</span>
                </div>
                {/* A CellGrid cell is flush to the panel's clipped edge, so this
                    link's ring has to be drawn inside its own box. */}
                <Link href="/returns" className={`${FOCUS_INSET} flex items-start gap-2 text-start`}>
                  <RotateCcw className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" aria-hidden="true" />
                  <span className="u-meta text-primary-ink underline-offset-4 hover:underline">{t("assurance.returns")}</span>
                </Link>
              </CellGrid>

              {seller && rfqHref && (
                <SellerCard
                  seller={seller}
                  locale={locale}
                  quoteHref={`/b2b/rfq/new?supplier=${encodeURIComponent(String(seller.id ?? ""))}`}
                  labels={{
                    eyebrow: t("seller.eyebrow"),
                    requestQuote: t("seller.requestQuote"),
                    location: (city, country) => t("seller.location", { city, country }),
                    ratingBasis: (count) => t("seller.ratingBasis", { count }),
                    // The stored SellerTier as a word in the reader's own
                    // language. A tier the message tree does not name renders
                    // nothing at all rather than leaking the raw enum: a pill
                    // reading "GOLD" on an Arabic page is the same defect as an
                    // English headline over an Arabic subtitle.
                    tier: (tier) =>
                      tier === "STANDARD" || tier === "VERIFIED" || tier === "GOLD" || tier === "PLATINUM"
                        ? t(`seller.tier.${tier}`)
                        : null,
                  }}
                />
              )}
            </div>
          </div>

          {/* Sections */}
          <div className="mt-block">
            {/*
              Plain anchors rather than buttons that call window.scrollTo: they
              are keyboard-native, they work before hydration and with JavaScript
              off, and the smooth scroll comes from the stylesheet, which is
              already switched off under prefers-reduced-motion. The active mark
              is the same drawn brass rule everything else on this page uses.

              The bar is a SIBLING of the content panel rather than its first
              child. An ancestor with `overflow: hidden` becomes the scroll box a
              sticky element sticks inside, and because that box never scrolls
              itself the bar would simply never stick — it would ride up the page
              with the panel. It also sits one step BELOW the site header in the
              stacking order, so a header that wraps taller on a narrow viewport
              covers this rather than the other way round.

              The focus ring is drawn inside each anchor: the strip scrolls
              horizontally, and a scroll container clips an outward ring.
            */}
            <Surface as="nav" rung={1} aria-label={t("sections.label")} className="sticky top-16 z-20 rounded-b-none">
              <ul className="flex overflow-x-auto scrollbar-hide">
                {SECTIONS.map((entry) => (
                  <li key={entry.id}>
                    <a
                      href={`#${entry.id}`}
                      aria-current={section === entry.id ? "true" : undefined}
                      className={`${FOCUS_INSET} relative flex h-row items-center whitespace-nowrap px-5 u-ui font-medium transition-colors duration-press ease-standard ${
                        section === entry.id ? "text-ink-1" : "text-ink-3 hover:text-ink-1"
                      }`}
                    >
                      {entry.label}
                      <Divider drawn on={section === entry.id} className="absolute inset-x-0 bottom-0" />
                    </a>
                  </li>
                ))}
              </ul>
            </Surface>

            {/* The panel's top edge is square and unruled because the nav above
                supplies both; when the nav is stuck, the panel scrolls underneath
                it and the seam is never visible. */}
            <Surface rung={2} className="overflow-hidden rounded-t-none border-t-0">

              <section id="description" className="scroll-mt-28 p-5 sm:p-8">
                <SectionHead>{t("sections.description")}</SectionHead>
                {(() => {
                  // The reader's own language leads at lead rank; the other is
                  // kept — a GCC procurement buyer routinely needs the English
                  // description of an Arabic listing and the reverse — but one
                  // rank down, so the two are a primary and a secondary rather
                  // than two paragraphs of equal weight. `dir` on the element is
                  // what flips the alignment; a physical text-right would fight
                  // it and break the moment the page itself is Arabic.
                  const en = p.descriptionEn ? String(p.descriptionEn) : "";
                  const ar = p.descriptionAr ? String(p.descriptionAr) : "";
                  const primary = locale === "ar" ? ar : en;
                  const secondary = locale === "ar" ? en : ar;
                  const primaryDir = locale === "ar" ? "rtl" : "ltr";
                  const secondaryDir = locale === "ar" ? "ltr" : "rtl";
                  if (!primary && !secondary) {
                    return <Dateline className="mt-3">{t("description.none")}</Dateline>;
                  }
                  return (
                    <>
                      {!!primary && (
                        <p className="mt-4 max-w-prose u-lead text-ink-2" dir={primaryDir}>{primary}</p>
                      )}
                      {!!secondary && (
                        <p className="mt-4 max-w-prose u-body text-ink-3" dir={secondaryDir}>{secondary}</p>
                      )}
                    </>
                  );
                })()}
              </section>

              <section id="specs" className="scroll-mt-28 border-t border-hairline p-5 sm:p-8">
                <SectionHead>{t("sections.specs")}</SectionHead>
                <Dateline className="mt-1">
                  {selectedVariant ? t("specs.basisVariant") : t("specs.basisProduct")}
                </Dateline>
                <div className="mt-4">
                  <SpecList rows={specRows} unrecordedLabel={(fields) => t("specs.unrecorded", { fields })} />
                </div>
              </section>

              <section id="reviews" className="scroll-mt-28 border-t border-hairline p-5 sm:p-8">
                <SectionHead>{t("sections.reviews")}</SectionHead>
                <div className="mt-4">
                  <ReviewPanel
                    slug={params.slug}
                    reviews={reviews}
                    reviewTotal={reviewTotal}
                    reviewTotalKnown={reviewTotalKnown}
                    avgRating={avgRating}
                    access={reviewAccess}
                    onSubmitted={onReviewSubmitted}
                    signInHref={`/login?callbackUrl=${encodeURIComponent(`/products/${params.slug}`)}`}
                    locale={locale}
                  />
                </div>
              </section>

              <section id="shipping" className="scroll-mt-28 border-t border-hairline p-5 sm:p-8">
                <SectionHead>{t("sections.shipping")}</SectionHead>
                <dl className="mt-4 grid max-w-none grid-cols-1 gap-x-10 gap-y-5 sm:grid-cols-2">
                  {[
                    { icon: Truck, title: t("shipping.delivery"), desc: t("shipping.deliveryBody") },
                    { icon: ShieldCheck, title: t("shipping.protection"), desc: t("shipping.protectionBody") },
                    { icon: RotateCcw, title: t("shipping.returns"), desc: t("shipping.returnsBody") },
                    // "Contact your account manager" named a service that exists
                    // nowhere in this product. Quotations do exist, and they are
                    // reachable from the supplier card above, so the line points
                    // at the mechanism that is actually implemented.
                    { icon: FileText, title: t("shipping.business"), desc: t("shipping.businessBody") },
                  ].map(({ icon: Icon, title, desc }) => (
                    <div key={title} className="flex gap-3">
                      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" aria-hidden="true" />
                      <div className="min-w-0">
                        <dt className="u-ui font-medium text-ink-1">{title}</dt>
                        <dd className="max-w-prose u-body text-ink-2">{desc}</dd>
                      </div>
                    </div>
                  ))}
                </dl>
              </section>
            </Surface>
          </div>

          {/* ─── The selling rails ─────────────────────────────
              Three lists, three different claims, labelled apart so each can
              be true: catalogue affinity, real co-purchase, real attention.
              Each states its basis under the heading, the way the home page
              does, and each renders only when it has rows. */}
          {rails && (
            [
              { key: "related", rows: rails.related },
              { key: "boughtTogether", rows: rails.boughtTogether },
              { key: "trending", rows: rails.trending },
            ] as const
          ).map(({ key, rows }) =>
            rows.length === 0 ? null : (
              <section key={key} aria-labelledby={`rail-${key}`} className="mt-12 lg:col-span-12">
                <h2 id={`rail-${key}`} className="u-h2 text-ink-1">{t(`sections.${key}`)}</h2>
                <p className="u-meta mt-1 text-ink-3">{t(`railReason.${key}`)}</p>
                <div className="mt-5">
                  <ProductGrid columns={5}>
                    {rows.map((row: any, i: number) => (
                      <ProductCard key={row.id} {...toCardRow(row, locale)} locale={locale} index={i} />
                    ))}
                  </ProductGrid>
                </div>
              </section>
            ),
          )}

          {/* Watched by the buy-bar observer: when this is on screen the reader
              has reached the end of the page and the fixed bar stands down. */}
          <div ref={pageEndRef} aria-hidden="true" className="h-px w-full" />
        </div>
      </div>

      {/*
        The buy action follows the buyer down the page on a phone. It is rung 4
        and OPAQUE rather than glass: body text never sits on a blur, and the
        blur budget on this page belongs to the header. It duplicates a control
        that is always in the document, so nothing is lost if the observer that
        reveals it never runs.

        The exit offset is a PERCENTAGE OF THE BAR'S OWN HEIGHT, not a fixed
        8px: this bar wraps to two lines on a 320px phone with a long currency
        and a long label, and a fixed offset makes the same gesture travel a
        different visual distance depending on what the bar happens to contain.
      */}
      <div
        className={`fixed inset-x-0 bottom-0 z-sticky lg:hidden transition-[opacity,transform] duration-panel ease-standard motion-reduce:transform-none ${
          buyBarVisible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-[14%] opacity-0"
        }`}
        aria-hidden={!buyBarVisible}
      >
        <Surface rung={4} className="flex items-center gap-3 rounded-none border-x-0 border-b-0 px-4 py-3">
          <div className="min-w-0">
            {selection ? (
              <PriceStack
                rank="card"
                amount={formatCurrency(
                  isB2B ? selection.unitPrice : selection.unitPrice + selection.vatPerUnit,
                  displayCurrency,
                  locale,
                )}
                vat={isB2B ? t("price.exclVat") : t("price.inclVat")}
              />
            ) : (
              <p className="truncate u-ui text-danger-ink">{t("price.none")}</p>
            )}
          </div>
          <Button
            size="lg"
            variant="primary"
            className="ms-auto min-w-[9rem] flex-1"
            disabled={!inStock || !selection || !buyBarVisible}
            tabIndex={buyBarVisible ? undefined : -1}
            onClick={addToCart}
          >
            {/* The SAME wipe as the control in the buy column, not a string
                swap. One gesture in one posture: a cross-fade here would put
                every frame of the label at partial opacity on the one control a
                buyer on a phone is watching most closely, and two different
                confirmations for one action is how a system starts reading as
                assembled rather than designed. */}
            <CommitLabel
              done={added !== null}
              idle={t("buy.addToCart")}
              committed={t("buy.addedShort")}
            />
          </Button>
        </Surface>
      </div>
    </MainLayout>
  );
}

/**
 * A section head, stamped.
 *
 * The short brass rule above the heading is the SAME drawn gesture as the active
 * section-nav item, the selected variant chip, the active band of the quantity
 * ladder, the volume offer and the certificate's top edge. One gesture in five
 * postures is what reads as a designed system; five different marks read as five
 * people. It is also what gives four long sections of a scrolling document a
 * rhythm you can find your place in.
 */
function SectionHead({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Divider drawn on className="w-10" />
      <h2 className="mt-3 u-h2 text-ink-1">{children}</h2>
    </>
  );
}
