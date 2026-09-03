"use client";

import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import * as React from "react";
import { useState, useEffect, useCallback, useRef } from "react";
import { ShoppingCart, Star, Heart, Truck, ShieldCheck, RotateCcw, Minus, Plus, MessageSquare, Package, ChevronRight, Check, FileText } from "lucide-react";
import {
  Button,
  Surface,
  FieldWell,
  CellGrid,
  Divider,
  Eyebrow,
  Num,
  Dateline,
  StatusPill,
  TierMark,
  EmptyState,
  Skeleton,
} from "@avenick/ui";
import { formatCurrency } from "@avenick/utils";
import { MainLayout } from "@/components/layout/main-layout";
import { useCartStore } from "@/stores/cart";
import { useWishlist } from "@/stores/wishlist";
import { resolveStorefrontSelection, toStorefrontCartLine, toStorefrontWishlistItem, type StorefrontProduct } from "@/lib/catalog-commercial";
import { defaultStorefrontCurrency, type Currency } from "@/lib/market-context";
import { ReviewForm, type SubmittedReview } from "@/components/product/review-form";

/**
 * <Surface as="button"> is typed with generic HTML attributes, which carry no
 * `type`. Declaring the attribute once here keeps the variant chips inert if one
 * of them ever ends up inside a form, without a cast at every call site.
 */
const BUTTON_TYPE = { type: "button" } as unknown as React.HTMLAttributes<HTMLElement>;

/**
 * A focus ring drawn INSIDE the control's own box.
 *
 * `.u-focus` paints its two-stop ring as an OUTWARD box-shadow, which is simply
 * invisible whenever the control is flush against a clipping parent — a cell of
 * a <CellGrid>, a row inside a well, a tab in a horizontally scrolling strip.
 * A negative outline-offset puts the ring colour inside the border box, where
 * nothing can clip it, and it composes with `shadow-*` instead of replacing it
 * the way a box-shadow ring would.
 */
const FOCUS_INSET =
  "outline-none focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring";

/**
 * Attribute keys are stored as the supplier typed them — "colorFamily",
 * "shelf_life". There is no enum→label map for a free-form attribute, so the
 * only safe thing to do is separate the words and capitalise the first. This is
 * presentation only: it never touches the value, and an unknown key still
 * renders whatever the supplier recorded.
 */
function attributeLabel(key: string): string {
  const spaced = key.replace(/[_-]+/g, " ").replace(/([a-z\d])([A-Z])/g, "$1 $2").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * The rating mark.
 *
 * The filled glyph is INK, not brass. Brass has exactly three permitted uses in
 * this system — the active-indicator rule, tier marks and verification marks —
 * and a rating is none of them: a brass star next to the brass <TierMark> on the
 * supplier card would make "four and a half stars" and "GOLD supplier" read as
 * the same class of claim. A semantic token is equally wrong, because it would
 * assert "warning" about a five-star review. Ink carries the rank, and the
 * figure beside it always says the same thing in words.
 *
 * The glyphs are hidden from assistive technology on purpose: every caller pairs
 * them with the figure itself, so the rating is never carried by colour or by an
 * icon alone.
 */
function Stars({ value, className = "h-4 w-4" }: { value: number; className?: string }) {
  const filled = Math.round(value);
  return (
    <span className="inline-flex items-center gap-0.5" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((step) => (
        <Star key={step} className={`${className} fill-current ${step <= filled ? "text-ink-1" : "text-border"}`} />
      ))}
    </span>
  );
}

/**
 * <Num> renders the currency mark at half the figure's size, which is what stops
 * a 46px price reading as the CODE shouted at the buyer. formatCurrency remains
 * the only thing deciding digits, grouping and decimals per currency — this only
 * splits its own leading code back off, and hands the whole string through
 * unchanged if that output shape ever differs.
 */
function splitMoney(amount: number, currency: Currency): { code?: string; figure: string } {
  const formatted = formatCurrency(amount, currency);
  const prefix = `${currency} `;
  return formatted.startsWith(prefix) ? { code: currency, figure: formatted.slice(prefix.length) } : { figure: formatted };
}

/** One line of the price breakdown: label at the inline start, figure at the end. */
function MoneyRow({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt className={`u-ui ${emphasis ? "font-medium text-ink-1" : "text-ink-2"}`}>{label}</dt>
      <dd className={`fig text-end ${emphasis ? "u-lead font-medium text-ink-1" : "u-ui text-ink-1"}`}>{value}</dd>
    </div>
  );
}

type Review = {
  id: string;
  rating: number;
  title?: string | null;
  body?: string | null;
  isVerified?: boolean;
  createdAt: string;
  user?: { firstName: string; lastName: string };
  /** Set only on a review merged in from this visitor's own POST response. */
  mine?: boolean;
};

/**
 * What the reviews section may offer the current visitor. Answered by the
 * eligibility endpoint, which reloads the account and checks for a DELIVERED
 * order containing this product; the POST re-checks all of it.
 */
type ReviewAccess =
  | { state: "loading" }
  | { state: "ready"; eligible: boolean; reason: "anonymous" | "not-purchased" | "already-reviewed" | "ok" }
  | { state: "blocked"; message: string }
  | { state: "unknown" };

type Tab = "description" | "specs" | "reviews" | "shipping";

export default function ProductPage({ params, searchParams }: { params: { slug: string }; searchParams: { currency?: string; b2b?: string; variantId?: string; qty?: string } }) {
  const [product, setProduct] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);
  const [activeImage, setActiveImage] = useState(0);
  const [tab, setTab] = useState<Tab>("description");
  const [selectedVariantId, setSelectedVariantId] = useState<string>();
  const [reviewAccess, setReviewAccess] = useState<ReviewAccess>({ state: "loading" });
  // The quantity that was actually added, not a boolean. The announcement names
  // a figure, and a buyer who nudges the stepper during the 2.4s confirmation
  // window would otherwise hear a number that was never sent to the cart.
  const [added, setAdded] = useState<number | null>(null);
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
    const ids: Tab[] = ["description", "specs", "reviews", "shipping"];
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
        if (first) setTab(first);
      },
      // Top inset clears the page header and the sticky section nav; the bottom
      // inset stops a section counting as "current" while it is only just
      // peeking in from below.
      { rootMargin: "-130px 0px -55% 0px", threshold: 0 },
    );
    for (const section of sections) observer.observe(section);
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
    const query = new URLSearchParams({ ...(currency ? { currency } : {}), ...(searchParams.b2b === "true" ? { b2b: "true" } : {}), ...extra });
    return `/api/products/${params.slug}${query.size ? `?${query}` : ""}`;
  }, [params.slug, searchParams.currency, searchParams.b2b]);

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
    // or the tab label and the rating row disagree with the list by exactly
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
  // jumps when the data lands. These shapes match the gallery and the buy column
  // below rather than four generic grey bars.
  if (loading) return (
    <MainLayout>
      <div className="mx-auto max-w-7xl px-4 py-8">
        <Skeleton className="mb-6 h-4 w-48" />
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
          <div>
            <Skeleton className="aspect-square w-full" />
            <div className="mt-3 flex gap-2">
              {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-16" />)}
            </div>
          </div>
          <div className="space-y-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-9 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-control-lg w-full" />
          </div>
        </div>
      </div>
    </MainLayout>
  );

  if (!product) return notFound();

  const p = product as Record<string, unknown> & StorefrontProduct;
  const images = (p.images as { url: string }[]) ?? [];
  const variants = p.variants ?? [];
  const selection = resolveStorefrontSelection(p, selectedVariantId, qty, searchParams.currency?.toUpperCase() ?? defaultStorefrontCurrency());
  const seller = p.seller as Record<string, unknown>;
  const brand = p.brand as { nameEn?: string; nameAr?: string | null } | null | undefined;
  const inStock = selection?.inStock === true;
  const selectedVariant = variants.find((variant) => variant.id === selectedVariantId);
  const availabilityStatus = selectedVariant?.availabilityStatus
    ?? p.inventory[0]?.status
    ?? (inStock ? "IN_STOCK" : "OUT_OF_STOCK");
  const displayPrice = selection?.unitPrice ?? 0;
  const displayCurrency = (selection?.currency ?? defaultStorefrontCurrency()) as Currency;
  const vatRate = selection?.vatRate ?? 0;
  const vatPerUnit = selection?.vatPerUnit ?? 0;
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
  const unitMoney = splitMoney(displayPrice, displayCurrency);

  /**
   * The volume ladder, derived by ASKING THE RESOLVER what a buyer would pay at
   * each published quantity break — never by re-reading the price rows here.
   * Re-implementing the tier rule in the page is exactly how a displayed ladder
   * drifts away from the price the cart actually charges; calling the same
   * function the cart calls cannot drift. Breaks that resolve to the same unit
   * price are one band to a buyer, so they are collapsed.
   */
  const priceLadder: { minQty: number; nextQty: number | null; unitPrice: number }[] = [];
  if (selection) {
    const breaks = Array.from(new Set(
      [...(selectedVariant?.prices ?? []), ...p.prices]
        .filter((price) => price.currency === selection.currency)
        .map((price) => Math.max(price.minQty, moq)),
    )).sort((a, b) => a - b);
    for (const breakQty of breaks) {
      const atBreak = resolveStorefrontSelection(p, selectedVariantId, breakQty, selection.currency);
      if (!atBreak || atBreak.currency !== selection.currency) continue;
      const previous = priceLadder[priceLadder.length - 1];
      if (previous && previous.unitPrice === atBreak.unitPrice) continue;
      priceLadder.push({ minQty: breakQty, nextQty: null, unitPrice: atBreak.unitPrice });
    }
    for (let i = 0; i < priceLadder.length - 1; i++) priceLadder[i].nextQty = priceLadder[i + 1].minQty;
  }

  const reviews = (p.reviews as Review[]) ?? [];
  const reviewCount = reviews.length;
  // The catalog returns the most recent reviews, not the full history. The
  // headline count is the server's total when it sends one; without it the
  // page can only count what it was given, and says so ("recent").
  const reviewTotalKnown = typeof p.reviewTotal === "number";
  const reviewTotal = reviewTotalKnown ? (p.reviewTotal as number) : reviewCount;
  const avgRating = reviewCount > 0 ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviewCount) * 10) / 10 : null;

  const TABS: { id: Tab; label: string }[] = [
    { id: "description", label: "Description" },
    { id: "specs", label: "Specifications" },
    { id: "reviews", label: `Reviews (${reviewTotal})` },
    { id: "shipping", label: "Shipping & Returns" },
  ];

  const addToCart = () => {
    if (!selection) return;
    addItem({ ...toStorefrontCartLine(p, selection, qty, searchParams.b2b === "true" ? "B2B" : "B2C", images[0]?.url), priceTiered });
    // The line is already in the cart by the time this runs: the confirmation is
    // a READOUT, never a gate. The button stays enabled, a second click simply
    // restarts the acknowledgement from wherever it is.
    setAdded(qty);
    clearTimeout(addedTimer.current);
    addedTimer.current = setTimeout(() => setAdded(null), 2400);
  };

  return (
    <MainLayout>
      {/* Bottom padding leaves room for the mobile buy bar, which is fixed. */}
      <div className="min-h-screen bg-background pb-24 lg:pb-0">
        <div className="mx-auto max-w-7xl px-4 py-8">

          <nav aria-label="Breadcrumb" className="mb-6">
            <ol className="flex items-center gap-1.5 text-meta text-ink-3">
              <li><Link href="/" className="u-focus rounded-sm hover:text-ink-1">Home</Link></li>
              {/* A chevron implies a reading direction, so it flips in Arabic. */}
              <li aria-hidden="true"><ChevronRight className="h-3 w-3 rtl:rotate-180" /></li>
              <li><Link href="/products" className="u-focus rounded-sm hover:text-ink-1">Products</Link></li>
              <li aria-hidden="true"><ChevronRight className="h-3 w-3 rtl:rotate-180" /></li>
              <li className="min-w-0"><span aria-current="page" className="block truncate font-medium text-ink-1">{String(p.nameEn)}</span></li>
            </ol>
          </nav>

          <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
            {/* Image gallery */}
            <div>
              <Surface rung={2} className="group relative mb-3 aspect-square overflow-hidden">
                {images[activeImage] ? (
                  // 1.03 over 320ms. The old scale-110 was an expensive repaint
                  // and it cropped a tenth of the product out of frame.
                  <Image src={images[activeImage].url} alt={String(p.nameEn)} fill className="object-cover transition-transform duration-layer ease-out group-hover:scale-[1.03] motion-reduce:transform-none" sizes="(max-width: 1024px) 100vw, 50vw" />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-ink-3">
                    <Package className="h-10 w-10" aria-hidden="true" />
                    {/* ink-3 is labels and metadata only; a sentence gets ink-2. */}
                    <p className="u-meta text-ink-2">No image has been uploaded for this product.</p>
                  </div>
                )}
                {!inStock && (
                  <div className="absolute inset-0 flex items-center justify-center bg-scrim/45">
                    {/* The label sits on an opaque token pill, never directly on
                        the darkened photograph. */}
                    <StatusPill tone={availabilityStatus === "UNCONFIRMED" ? "warning" : "danger"} className="px-3 py-1">
                      {availabilityStatus === "UNCONFIRMED" ? "Availability unconfirmed" : "Out of stock"}
                    </StatusPill>
                  </div>
                )}
              </Surface>
              {images.length > 1 && (
                // The strip is context and the thumbnails are the actions on it,
                // so the well is recessed and each thumbnail stands off it.
                <FieldWell className="flex gap-2 overflow-x-auto p-2">
                  {images.map((img, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setActiveImage(i)}
                      aria-label={`Show image ${i + 1} of ${images.length}`}
                      aria-pressed={activeImage === i}
                      // Opacity only. Box-shadow is never animated in this system —
                      // it repaints the element every frame — and the selected edge
                      // is a border rather than a Tailwind ring for the same reason
                      // the variant chips use one: `ring-*` compiles to a box-shadow
                      // and would fight the elevation token.
                      className={`${FOCUS_INSET} h-16 w-16 shrink-0 overflow-hidden rounded-nested border transition-opacity duration-hover ease-standard ${
                        activeImage === i ? "border-primary opacity-100 shadow-elev-2" : "border-border opacity-70 hover:opacity-100"
                      }`}
                    >
                      <Image src={img.url} alt="" width={64} height={64} className="h-full w-full object-cover" />
                    </button>
                  ))}
                </FieldWell>
              )}
            </div>

            {/* Product info */}
            <div className="space-y-5">
              {/* Identity */}
              <div>
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    {!!brand?.nameEn && <Eyebrow tone="primary" className="mb-1.5">{brand.nameEn}</Eyebrow>}
                    <h1 className="u-h1 text-ink-1">{String(p.nameEn)}</h1>
                    {!!p.nameAr && <p className="u-lead mt-1 text-ink-2" dir="rtl">{String(p.nameAr)}</p>}
                  </div>
                  <Button
                    variant={wishlisted ? "secondary" : "ghost"}
                    size="icon"
                    className="shrink-0"
                    disabled={!selection}
                    aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
                    aria-pressed={wishlisted}
                    onClick={() => selection && toggle({ ...toStorefrontWishlistItem(p, params.slug, selection, qty, searchParams.b2b === "true" ? "B2B" : "B2C", images[0]?.url), priceTiered })}
                  >
                    <Heart className={`h-5 w-5 ${wishlisted ? "fill-current text-danger-ink" : ""}`} />
                  </Button>
                </div>

                {/* Rating. The figure always accompanies the mark, so the rating
                    is never carried by an icon or a colour alone. */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  {avgRating == null ? (
                    <span className="u-meta text-ink-3">No reviews yet</span>
                  ) : (
                    <a
                      href="#reviews"
                      className="u-focus inline-flex items-center gap-2 rounded-sm"
                      aria-label={`Rated ${avgRating} out of 5. Read ${reviewTotal} ${reviewTotalKnown ? "" : "recent "}review${reviewTotal !== 1 ? "s" : ""}.`}
                    >
                      <Stars value={avgRating} />
                      <span className="fig u-ui font-medium text-ink-1">{avgRating}</span>
                      <span className="u-meta text-ink-3 underline-offset-4 hover:underline" aria-hidden="true">
                        {reviewTotal} {reviewTotalKnown ? "" : "recent "}review{reviewTotal !== 1 ? "s" : ""}
                      </span>
                    </a>
                  )}
                  <span className="u-meta text-ink-3">
                    SKU <span className="u-mono text-ink-2">{selection?.sku ?? String(p.sku)}</span>
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {availabilityStatus === "IN_STOCK"
                    ? <StatusPill tone="success" dot>In stock</StatusPill>
                    : availabilityStatus === "UNCONFIRMED"
                      ? <StatusPill tone="warning" dot>Availability unconfirmed</StatusPill>
                      : <StatusPill tone="danger" dot>Out of stock</StatusPill>}
                  {!!p.origin && <StatusPill tone="neutral">Origin {String(p.origin)}</StatusPill>}
                  {!!p.isB2BEnabled && <StatusPill tone="accent">Available for business orders</StatusPill>}
                </div>
              </div>

              {variants.length > 0 && (
                <div>
                  <Eyebrow id="variant-group-label" className="mb-2">Variant</Eyebrow>
                  <div role="group" aria-labelledby="variant-group-label" className="flex flex-wrap gap-2">
                    {variants.map((variant) => {
                      const active = selectedVariantId === variant.id;
                      const attributes = Object.entries((variant.attributes ?? {}) as Record<string, unknown>)
                        .map(([key, value]) => `${attributeLabel(key)} ${String(value)}`).join(" · ");
                      return (
                        // A chooser is an input, so an unchosen option is recessed
                        // and the chosen one lifts out of the well. The brass rule
                        // draws itself in from the inline start — the same active
                        // mark the nav uses, so selection reads the same everywhere.
                        // The selected edge is a border rather than a ring: Tailwind's
                        // ring-* utilities emit a box-shadow, which would replace the
                        // rung's elevation shadow outright and flatten the ladder.
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
                          <span className="block u-ui font-medium text-ink-1">{variant.nameEn}</span>
                          <span className="block u-meta text-ink-3">{attributes || variant.sku}</span>
                          {!variant.inStock && (
                            <StatusPill tone="neutral" className="mt-1.5">Out of stock</StatusPill>
                          )}
                          <Divider drawn on={active} className="absolute inset-x-0 bottom-0" />
                        </Surface>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* The price block. Three numbers a buyer has to reconcile — unit,
                  tax, total — plus the quantity band they are being priced in.
                  It is a card rather than an indigo wash: the primary fill budget
                  belongs to the one commit action on this page. */}
              <Surface rung={2} className="p-5">
                {selection ? <>
                  <Eyebrow>{priceLadder.length > 1 ? `Unit price at ${qty} unit${qty !== 1 ? "s" : ""}` : "Unit price"}</Eyebrow>
                  <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <Num rank="hero" currency={unitMoney.code} value={unitMoney.figure} />
                    <span className="u-meta text-ink-3">excl. VAT</span>
                  </div>

                  <dl className="mt-4 border-t border-hairline divide-y divide-hairline">
                    <MoneyRow label={`VAT at ${vatRate}%, per unit`} value={formatCurrency(vatPerUnit, displayCurrency)} />
                    <MoneyRow label="Quantity" value={`${qty} unit${qty !== 1 ? "s" : ""}`} />
                    <MoneyRow label="Total including VAT" value={formatCurrency(selection.grossTotal, displayCurrency)} emphasis />
                  </dl>

                  <Dateline className="mt-2">
                    Published price for this selection at this quantity · price, tax and availability are revalidated when the order is submitted
                  </Dateline>

                  {priceLadder.length > 1 && (
                    // The bands the supplier actually published, each row showing
                    // what the resolver says a buyer pays there. Choosing a row
                    // moves the quantity to that band's start.
                    <FieldWell className="mt-4">
                      <div className="flex flex-wrap items-baseline justify-between gap-2 px-3 pt-3 pb-2">
                        <Eyebrow>Volume pricing</Eyebrow>
                        {moq > 1 && <span className="u-meta text-ink-3">Minimum order {moq} units</span>}
                      </div>
                      {/* The rows are inset from the well rather than bled to its
                          edge: a full-bleed row inside a clipped container loses
                          its focus ring entirely. The band the buyer is currently
                          priced in lifts OUT of the well onto rung 2, which is the
                          same reading the variant chooser gives — selected is
                          raised — and it carries the brass active-indicator rule. */}
                      <ul className="space-y-1 border-t border-hairline p-1.5">
                        {priceLadder.map((band) => {
                          const current = qty >= band.minQty && (band.nextQty === null || qty < band.nextQty);
                          return (
                            <li key={band.minQty}>
                              <button
                                type="button"
                                onClick={() => setQty(Math.max(band.minQty, moq))}
                                aria-current={current ? "true" : undefined}
                                aria-label={`Price ${band.minQty}${band.nextQty ? ` to ${band.nextQty - 1}` : " or more"} units at ${formatCurrency(band.unitPrice, displayCurrency)} each — set quantity to ${band.minQty}`}
                                className={`${FOCUS_INSET} flex w-full items-baseline justify-between gap-3 rounded-nested border-s-2 px-2.5 py-2 text-start transition-colors duration-press ease-standard ${
                                  current ? "border-brass bg-surface-2 shadow-elev-2" : "border-transparent hover:bg-surface-2/60"
                                }`}
                              >
                                <span className="u-ui text-ink-2">
                                  {band.minQty}{band.nextQty ? `–${band.nextQty - 1}` : "+"} units
                                </span>
                                <span className="fig u-ui text-ink-1">
                                  {formatCurrency(band.unitPrice, displayCurrency)}
                                  <span className="u-meta text-ink-3"> /unit</span>
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </FieldWell>
                  )}
                </> : <>
                  <Eyebrow>Unit price</Eyebrow>
                  <p className="mt-1 u-body text-danger-ink">No applicable price is available for this selection and quantity.</p>
                  <Dateline className="mt-2">
                    Prices are published per currency and per quantity band; none of the published bands covers this combination
                  </Dateline>
                </>}
              </Surface>

              {/* Quantity + the one primary fill on the page */}
              <div ref={buyBoxRef} className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  {/* Named as a group so the live quantity is not announced as a
                      bare number with no idea what it counts, and NOT clipped:
                      the ± buttons are flush to the well's edges, so an
                      overflow-hidden here would swallow their focus ring. */}
                  <FieldWell role="group" aria-label="Quantity" className="inline-flex items-center">
                    <button
                      type="button"
                      aria-label="Decrease quantity"
                      disabled={!selection || qty <= moq}
                      onClick={() => setQty((q) => Math.max(moq, q - 1))}
                      className="u-focus flex h-control-lg w-11 items-center justify-center text-ink-2 transition-colors duration-press ease-standard hover:text-ink-1 disabled:opacity-40"
                    >
                      <Minus className="h-4 w-4" aria-hidden="true" />
                    </button>
                    {/* Announced, not animated: a figure a buyer reads never
                        counts up, it just changes. */}
                    <span className="fig min-w-[3rem] text-center u-ui font-medium text-ink-1" aria-live="polite" aria-atomic="true">{qty}</span>
                    <button
                      type="button"
                      aria-label="Increase quantity"
                      disabled={!selection || qty >= selection.availableQty}
                      onClick={() => setQty((q) => q + 1)}
                      className="u-focus flex h-control-lg w-11 items-center justify-center text-ink-2 transition-colors duration-press ease-standard hover:text-ink-1 disabled:opacity-40"
                    >
                      <Plus className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </FieldWell>
                  <Button size="lg" variant="primary" className="min-w-[12rem] flex-1" disabled={!inStock || !selection} onClick={addToCart}>
                    {added !== null
                      ? <><Check className="h-4 w-4" aria-hidden="true" />Added to cart</>
                      : <><ShoppingCart className="h-4 w-4" aria-hidden="true" />Add to cart</>}
                  </Button>
                </div>
                <p role="status" aria-live="polite" className="sr-only">{added !== null ? `${added} added to your cart.` : ""}</p>

                {moq > 1 && (
                  <p className="u-meta text-ink-2">
                    Minimum order {moq} units. The quantity cannot go below it.
                  </p>
                )}

                {!inStock && seller && (
                  <Button asChild variant="secondary" size="lg" className="w-full">
                    <Link href={`/b2b/rfq/new?supplier=${encodeURIComponent(String(seller.id ?? ""))}&product=${encodeURIComponent(productId)}`}>
                      <MessageSquare className="h-4 w-4" aria-hidden="true" /> Request availability
                    </Link>
                  </Button>
                )}
              </div>

              {/*
                Every claim here must be backed by an implemented rule.
                "Verified Supplier" was asserted for every seller regardless of
                tier — the real tier is rendered from seller.tier below. "14-day
                returns" named a window that exists nowhere in the schema or
                services. One hairline-divided panel rather than three bordered
                tiles, and the icons carry no hue: ten colours saying nothing is
                the loudest amateur signal there is.
              */}
              {/* One column on a phone: three centred columns of 12px text put
                  "Delivery quoted at checkout" on three lines at 360px. The rows
                  read from the inline start, which is also what lets the icon and
                  the sentence share a baseline in both directions. */}
              <CellGrid cols={{ base: 1, sm: 3 }} density="compact">
                <div className="flex items-start gap-2 text-start">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" aria-hidden="true" />
                  <span className="u-meta text-ink-2">Price checked at order</span>
                </div>
                <div className="flex items-start gap-2 text-start">
                  <Truck className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" aria-hidden="true" />
                  <span className="u-meta text-ink-2">Delivery quoted at checkout</span>
                </div>
                {/* A CellGrid cell is flush to the panel's clipped edge, so this
                    link's ring has to be drawn inside its own box. */}
                <Link href="/returns" className={`${FOCUS_INSET} flex items-start gap-2 text-start`}>
                  <RotateCcw className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" aria-hidden="true" />
                  <span className="u-meta text-primary-ink underline-offset-4 hover:underline">Returns &amp; refunds</span>
                </Link>
              </CellGrid>

              {/* Seller */}
              {seller && (
                <Surface rung={2} className="p-4">
                  <Eyebrow>Sold by</Eyebrow>
                  <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="u-lead font-medium text-ink-1">{String(seller.businessNameEn)}</p>
                      {!!seller.businessNameAr && <p className="u-ui text-ink-2" dir="rtl">{String(seller.businessNameAr)}</p>}
                      {/* Aggregated from this seller's product reviews by the
                          service. Absent when they have none — a seller with no
                          reviews shows no star rather than a zero. */}
                      {(() => {
                        const summary = seller.reviewSummary as { averageRating: number | null; reviewCount: number } | undefined;
                        if (!summary || summary.averageRating === null || summary.reviewCount === 0) return null;
                        return (
                          <p className="mt-1.5 flex items-center gap-2">
                            <Stars value={summary.averageRating} className="h-3.5 w-3.5" />
                            <span className="fig u-ui font-medium text-ink-1">{summary.averageRating.toFixed(1)}</span>
                            <span className="u-meta text-ink-3">
                              across {summary.reviewCount} review{summary.reviewCount === 1 ? "" : "s"} of this supplier
                            </span>
                          </p>
                        );
                      })()}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      {/* TierMark is the only component permitted to emit brass,
                          and a tier is one of its three permitted uses. A tier the
                          mark does not recognise stays a neutral pill rather than
                          being dressed up as an accolade. */}
                      {seller.tier === "GOLD" || seller.tier === "PLATINUM" || seller.tier === "VERIFIED"
                        ? <TierMark tier={String(seller.tier)} />
                        : <StatusPill tone="neutral">{String(seller.tier)}</StatusPill>}
                      <Button asChild variant="secondary" size="sm">
                        <Link href={`/b2b/rfq/new?supplier=${String(seller.id ?? "")}`}>
                          <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" /> Request quote
                        </Link>
                      </Button>
                    </div>
                  </div>
                </Surface>
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
              is the same drawn brass rule the navigation uses.

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
            <Surface as="nav" rung={1} aria-label="Product sections" className="sticky top-16 z-20 rounded-b-none">
              <ul className="flex overflow-x-auto">
                {TABS.map((t) => (
                  <li key={t.id}>
                    <a
                      href={`#${t.id}`}
                      aria-current={tab === t.id ? "true" : undefined}
                      className={`${FOCUS_INSET} relative flex h-row items-center whitespace-nowrap px-5 u-ui font-medium transition-colors duration-press ease-standard ${
                        tab === t.id ? "text-ink-1" : "text-ink-3 hover:text-ink-1"
                      }`}
                    >
                      {t.label}
                      <Divider drawn on={tab === t.id} className="absolute inset-x-0 bottom-0" />
                    </a>
                  </li>
                ))}
              </ul>
            </Surface>

            {/* The panel's top edge is square and unruled because the nav above
                supplies both; when the nav is stuck, the panel scrolls underneath
                it and the seam is never visible. */}
            <Surface rung={2} className="overflow-hidden rounded-t-none border-t-0">

              {/* Description */}
              <section id="description" className="scroll-mt-28 p-5 sm:p-6">
                <h2 className="u-h3 text-ink-1">Description</h2>
                {p.descriptionEn
                  ? <p className="mt-3 max-w-prose u-body text-ink-2">{String(p.descriptionEn)}</p>
                  : <Dateline className="mt-3">No description has been published for this product</Dateline>}
                {/* dir="rtl" already flips the alignment; a physical text-right
                    would fight it and break the moment the page is Arabic. */}
                {!!p.descriptionAr && <p className="mt-4 max-w-prose u-body text-ink-2" dir="rtl">{String(p.descriptionAr)}</p>}
              </section>

              {/* Specifications */}
              <section id="specs" className="scroll-mt-28 border-t border-hairline p-5 sm:p-6">
                <h2 className="u-h3 text-ink-1">Specifications</h2>
                <Dateline className="mt-1">
                  {selectedVariant
                    ? "As recorded on this product and the selected variant"
                    : "As recorded on this product"}
                </Dateline>
                <dl className="mt-4 grid grid-cols-1 gap-x-10 sm:grid-cols-2">
                  {[
                    { label: "SKU", value: selection?.sku ?? String(p.sku), mono: true },
                    { label: "Brand", value: brand?.nameEn ?? null },
                    { label: "Origin", value: p.origin ? String(p.origin) : null },
                    { label: "Weight", value: p.weight ? `${String(p.weight)} kg` : null },
                    { label: "Minimum order", value: `${moq} unit${moq === 1 ? "" : "s"}` },
                    { label: "Consumer orders", value: p.isB2CEnabled ? "Available" : "Not available" },
                    { label: "Business orders", value: p.isB2BEnabled ? "Available" : "Not available" },
                    // The selected variant's own attributes: currently the only
                    // place they appear is squeezed into the chooser's subtitle.
                    ...Object.entries((selectedVariant?.attributes ?? {}) as Record<string, unknown>)
                      .map(([key, value]) => ({ label: attributeLabel(key), value: String(value) })),
                  ].map(({ label, value, mono }: { label: string; value: string | null; mono?: boolean }) => (
                    <div key={label} className="flex items-baseline justify-between gap-4 border-b border-hairline py-2.5">
                      <dt className="u-ui text-ink-3">{label}</dt>
                      {/* A field the supplier has not filled in says so. An em-dash
                          makes an unrecorded value look like a recorded zero. */}
                      <dd className={`u-ui text-end ${value ? "text-ink-1" : "text-ink-3"} ${mono ? "u-mono" : ""}`}>
                        {value ?? "Not recorded"}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>

              {/* Reviews */}
              <section id="reviews" className="scroll-mt-28 border-t border-hairline p-5 sm:p-6">
                <h2 className="u-h3 text-ink-1">Reviews</h2>

                {avgRating != null && (
                  <FieldWell className="mt-4 flex flex-wrap items-center gap-x-8 gap-y-3 p-4">
                    <div>
                      <Num rank="section" value={avgRating} unit="/ 5" />
                      <div className="mt-1 flex items-center gap-2">
                        <Stars value={avgRating} />
                        <span className="sr-only">Average rating {avgRating} out of 5.</span>
                      </div>
                    </div>
                    {/* The average is over the reviews shown, never over the total: when the
                        server reports more than it sent, the label says which subset it is. */}
                    <Dateline>
                      {reviewTotal > reviewCount
                        ? `Averaged over the ${reviewCount} most recent review${reviewCount !== 1 ? "s" : ""} of ${reviewTotal}`
                        : `Averaged over ${reviewCount} ${reviewTotalKnown ? "" : "recent "}review${reviewCount !== 1 ? "s" : ""}`}
                    </Dateline>
                  </FieldWell>
                )}

                {/*
                  Who may write here is decided by the eligibility endpoint,
                  never by the page: a form is shown only to a signed-in
                  buyer with a DELIVERED order containing this product.
                  The "Verified" badge on a review means exactly that.
                */}
                <div className="mt-4">
                  {/* The eligibility answer arrives after the product does, so the
                      line it will occupy is reserved rather than left to appear and
                      push the review list down under the reader. */}
                  {reviewAccess.state === "loading" && <Skeleton className="h-5 w-72 max-w-full" />}
                  {reviewAccess.state === "ready" && reviewAccess.reason === "ok" && (
                    <ReviewForm slug={params.slug} onSubmitted={onReviewSubmitted} />
                  )}
                  {reviewAccess.state === "ready" && reviewAccess.reason === "anonymous" && (
                    <p className="u-ui text-ink-2">
                      <Link href={`/login?callbackUrl=${encodeURIComponent(`/products/${params.slug}`)}`} className="u-focus rounded-sm text-primary-ink underline-offset-4 hover:underline">Sign in</Link>
                      {" "}to review this product. Reviews are open to buyers who have received it.
                    </p>
                  )}
                  {reviewAccess.state === "ready" && reviewAccess.reason === "not-purchased" && (
                    <p className="u-ui text-ink-2">Only buyers who received this product can review it.</p>
                  )}
                  {reviewAccess.state === "ready" && reviewAccess.reason === "already-reviewed" && (
                    <p className="u-ui text-ink-2">You have already reviewed this product.</p>
                  )}
                  {reviewAccess.state === "blocked" && (
                    <p className="u-ui text-ink-2">{reviewAccess.message}</p>
                  )}
                  {reviewAccess.state === "unknown" && (
                    <p className="u-ui text-ink-2">Could not check whether you can review this product right now.</p>
                  )}
                </div>

                {reviewCount === 0 ? (
                  <EmptyState
                    eyebrow="No reviews recorded"
                    headline="No one has reviewed this product yet."
                    body="Reviews here are written only by buyers whose order containing this product was delivered, so the page shows none until one has been."
                  />
                ) : (
                  <ul className="mt-2 divide-y divide-hairline">
                    {reviews.map((r) => {
                      // The author line never claims more than the row proves: a name when
                      // the API returned one, "You" for the review just merged from this
                      // visitor's own submit, otherwise a plain "Buyer" (the badge, not the
                      // name, carries the verified claim).
                      const author = r.user ? `${r.user.firstName} ${r.user.lastName.charAt(0)}.`.trim() : r.mine ? "You" : "Buyer";
                      const date = new Date(r.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
                      return (
                        <li key={r.id} className="py-4">
                          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                            <div className="min-w-0">
                              <p className="flex flex-wrap items-center gap-2 u-ui font-medium text-ink-1">
                                {author}
                                {r.isVerified && <StatusPill tone="success">Verified</StatusPill>}
                              </p>
                              <p className="mt-1 flex items-center gap-2">
                                <Stars value={r.rating} className="h-3.5 w-3.5" />
                                <span className="u-meta text-ink-3">{r.rating} out of 5</span>
                              </p>
                            </div>
                            <span className="u-meta shrink-0 text-ink-3">{date}</span>
                          </div>
                          {r.title && <p className="mt-2 u-ui font-medium text-ink-1">{r.title}</p>}
                          {r.body && <p className="mt-1 max-w-prose u-body text-ink-2">{r.body}</p>}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              {/* Shipping */}
              <section id="shipping" className="scroll-mt-28 border-t border-hairline p-5 sm:p-6">
                <h2 className="u-h3 text-ink-1">Shipping &amp; returns</h2>
                <dl className="mt-4 max-w-prose space-y-4">
                  {[
                    { icon: Truck, title: "Delivery", desc: "Available delivery terms are confirmed during order processing." },
                    { icon: ShieldCheck, title: "Order protection", desc: "Price, tax and availability are revalidated when the order is submitted." },
                    { icon: RotateCcw, title: "Returns policy", desc: "Return eligibility and any applicable window are confirmed against the published returns policy when a return is requested." },
                    // "Contact your account manager" named a service that exists
                    // nowhere in this product. Quotations do exist, and they are
                    // reachable from the supplier card above, so the line now
                    // points at the mechanism that is actually implemented.
                    { icon: FileText, title: "Business orders", desc: "Bulk quantities are priced from the bands the supplier has published. Terms beyond those bands are agreed on a quotation." },
                  ].map(({ icon: Icon, title, desc }) => (
                    <div key={title} className="flex gap-3">
                      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" aria-hidden="true" />
                      <div>
                        <dt className="u-ui font-medium text-ink-1">{title}</dt>
                        <dd className="u-body text-ink-2">{desc}</dd>
                      </div>
                    </div>
                  ))}
                </dl>
              </section>
            </Surface>
          </div>

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
      */}
      <div
        className={`fixed inset-x-0 bottom-0 z-sticky lg:hidden transition-[opacity,transform] duration-panel ease-standard motion-reduce:transform-none ${
          buyBarVisible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0"
        }`}
        aria-hidden={!buyBarVisible}
      >
        <Surface rung={4} className="flex items-center gap-3 rounded-none border-x-0 border-b-0 px-4 py-3">
          <div className="min-w-0">
            <Eyebrow>Unit price</Eyebrow>
            {selection
              ? <p className="fig truncate u-lead font-medium text-ink-1">{formatCurrency(displayPrice, displayCurrency)}</p>
              : <p className="truncate u-ui text-danger-ink">No applicable price</p>}
          </div>
          <Button
            size="lg"
            variant="primary"
            className="ms-auto min-w-[9rem] flex-1"
            disabled={!inStock || !selection || !buyBarVisible}
            tabIndex={buyBarVisible ? undefined : -1}
            onClick={addToCart}
          >
            {added !== null
              ? <><Check className="h-4 w-4" aria-hidden="true" />Added</>
              : <><ShoppingCart className="h-4 w-4" aria-hidden="true" />Add to cart</>}
          </Button>
        </Surface>
      </div>
    </MainLayout>
  );
}
