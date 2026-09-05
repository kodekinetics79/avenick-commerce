"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { useTranslations } from "next-intl";
import { Surface } from "@avenick/ui";
import { cn } from "@avenick/utils";
import { storefrontProductHref } from "@/lib/product-card-commerce";
import type { HeroSlide } from "./hero-slides";

/**
 * The hero's object, as a carousel of the products the page already loaded.
 *
 * Apple's hero media, taken as a BEHAVIOUR rather than as an asset: one object
 * at a time, a crossfade with a 1.02 → 1 settle on the object, six seconds per
 * slide, and a page that never has to become a client component to get it —
 * this island is the whole client surface, and the copy column beside it stays
 * a server-rendered block that does not turn.
 *
 * NO VIDEO. There is no product video asset, and stock footage would be a
 * fabrication — a hero made of things the catalogue does not hold, which is the
 * one unsurvivable failure in this product. The slides are real listings with
 * real captions, and nothing else.
 *
 * THE BEHAVIOUR MATRIX
 *   auto-advance      6s, only while more than one slide exists
 *   hover             paused while the pointer is over the carousel
 *   focus             paused while any control inside it has focus
 *   hidden tab        paused while document.visibilityState is "hidden"
 *   reduced motion    NEVER advances on its own; the crossfade keeps its 200ms
 *                     opacity (a state change the user needs to perceive) and
 *                     loses the settle, in globals.css §13; the pause control is
 *                     withdrawn because there is nothing for it to pause
 *   pause control     a real toggle button; the user's pause outranks resume
 *   prev / next / dot real <button>s with translated labels; the active dot
 *                     carries aria-current; any of them restarts the six seconds
 *   swipe             touch and pen only, 40px horizontal, mirrored under RTL;
 *                     a tap still follows the link, a swipe never does
 *   RTL               chevrons flip with rtl:rotate-180, dots follow the flex
 *                     row's direction, swipe reads the computed direction
 *   live region       polite while paused or user-driven, off while rotating —
 *                     a screen reader is not told about every automatic turn
 *   JS off            slide one is visible and linked; the controls are inert
 *
 * LAW D. Every state has already changed before anything animates: the timer
 * changes the index and CSS reports it. No queue, no pointer-events window, and
 * the transitions are interruptible by construction.
 */
const ADVANCE_MS = 6000;
const SWIPE_PX = 40;

const CONTROL =
  "u-focus grid h-control-md w-control-md shrink-0 place-items-center rounded-nested text-white/85 transition-colors duration-hover ease-standard hover:bg-white/10 hover:text-white";

export interface HeroCarouselProps {
  slides: HeroSlide[];
  className?: string;
}

export function HeroCarousel({ slides, className }: HeroCarouselProps) {
  const t = useTranslations("home");
  const tc = useTranslations("catalogue");
  const total = slides.length;

  const [index, setIndex] = React.useState(0);
  const [hovered, setHovered] = React.useState(false);
  const [focused, setFocused] = React.useState(false);
  const [tabHidden, setTabHidden] = React.useState(false);
  const [reducedMotion, setReducedMotion] = React.useState(false);
  const [stopped, setStopped] = React.useState(false);

  // Read in effects, never during render: the server does not know the user's
  // motion preference or tab state, and guessing them is a hydration mismatch.
  React.useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  React.useEffect(() => {
    const sync = () => setTabHidden(document.visibilityState === "hidden");
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);

  const rotating = total > 1 && !reducedMotion && !stopped && !hovered && !focused && !tabHidden;

  // One timeout per slide rather than an interval: any change of index — a
  // click, a swipe, the timer itself — re-arms it, so a manual step always gets
  // a full six seconds before the next automatic one.
  React.useEffect(() => {
    if (!rotating) return;
    const id = window.setTimeout(() => setIndex((i) => (i + 1) % total), ADVANCE_MS);
    return () => window.clearTimeout(id);
  }, [rotating, index, total]);

  const step = React.useCallback(
    (delta: number) => setIndex((i) => (i + delta + total) % total),
    [total],
  );

  /* Swipe. Pointer events, with `touch-action: pan-y pinch-zoom` on the region
     so the browser keeps vertical scrolling and zoom and hands us only the
     horizontal moves; a vertical pan cancels the gesture. Mouse drags are ignored — a mouse has the
     buttons — and a tap (under the threshold) is left alone so the link fires. */
  const gesture = React.useRef<{ id: number; x: number; y: number } | null>(null);
  const swiped = React.useRef(false);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse") return;
    gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    swiped.current = false;
  };
  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = gesture.current;
    gesture.current = null;
    if (!start || start.id !== event.pointerId) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) <= Math.abs(dy)) return;
    swiped.current = true;
    // "Next" lives at the inline END: to the left in Arabic, so the same
    // physical swipe has to read the opposite way. Computed direction, never
    // a locale guess.
    const dir = getComputedStyle(event.currentTarget).direction === "rtl" ? -1 : 1;
    step(dx * dir < 0 ? 1 : -1);
  };
  const onPointerCancel = () => {
    gesture.current = null;
  };
  // A swipe that ended on the link must not also follow it.
  const onClickCapture = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!swiped.current) return;
    swiped.current = false;
    event.preventDefault();
    event.stopPropagation();
  };

  if (total === 0) return null;

  return (
    <div
      role="group"
      aria-roledescription={t("heroCarouselRole")}
      aria-label={t("heroCarouselLabel")}
      className={cn("touch-pan-y touch-pinch-zoom", className)}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(event) => setFocused(event.currentTarget.contains(event.relatedTarget as Node | null))}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onClickCapture={onClickCapture}
    >
      {/* The stack. Slides share one grid cell, so the column is as tall as the
          tallest caption and the hero's height never changes as the slides
          turn. Inactive slides are visibility:hidden in CSS — out of the tab
          order and the accessibility tree, and painted by nothing. */}
      <div className="u-slides" aria-live={rotating ? "off" : "polite"}>
        {slides.map((slide, i) => {
          const active = i === index;
          return (
            <div
              key={slide.id}
              className="u-slide min-w-0"
              data-active={active ? "true" : "false"}
              aria-hidden={active ? undefined : true}
              role="group"
              aria-roledescription={t("heroSlideRole")}
              aria-label={t("heroSlidePosition", { n: String(i + 1), total: String(total) })}
            >
              <Link
                href={storefrontProductHref(slide.slug, { currency: slide.currency ?? undefined })}
                aria-label={t("specimenView", { name: slide.name })}
                tabIndex={active ? undefined : -1}
                className="u-focus group block rounded-3xl"
              >
                {/* THE OBJECT — the one layer that moves with the page. The
                    settle is on this box; .u-float's rise is on the child so
                    the two transforms never fight; and the scroll parallax is
                    the independent `translate` on this box, decorative by
                    construction because it holds nothing but the photograph. */}
                <div className="u-slide__object relative aspect-square w-full">
                  <div className="u-float absolute inset-0">
                    {slide.imageUrl ? (
                      <Image
                        src={slide.imageUrl}
                        alt=""
                        aria-hidden="true"
                        fill
                        priority={i === 0}
                        sizes="(min-width: 1536px) 26rem, (min-width: 1280px) 24rem, (min-width: 1024px) 20rem, 0px"
                        className="object-contain drop-shadow-2xl transition-transform duration-hover ease-standard group-hover:-translate-y-1 group-hover:scale-[1.03]"
                      />
                    ) : null}
                  </div>
                </div>

                {/* Glass, over the photograph it actually refracts. One painted
                    per viewport: the others are hidden, not merely transparent. */}
                <Surface rung={4} glass className="mt-3 p-3">
                  {slide.category ? <p className="u-meta text-ink-3">{slide.category}</p> : null}
                  <p className="u-ui mt-0.5 font-medium text-ink-1">{slide.name}</p>
                  {slide.amount ? (
                    /* The product's own figure at card rank, with the qualifier
                       as a meta run BESIDE it — never baked into the string,
                       where it would collapse the figure's rank at exactly the
                       place a buyer looks first. */
                    <p className="mt-1 flex flex-wrap items-baseline gap-x-1.5">
                      {slide.isFrom ? <span className="u-meta text-ink-2">{tc("from")}</span> : null}
                      <span className="tnum text-fig-card font-semibold text-ink-1">{slide.amount}</span>
                    </p>
                  ) : (
                    /* No public price is a stated fact, not a missing one. */
                    <p className="u-meta mt-1 text-ink-2">{tc("quoteOnRequest")}</p>
                  )}
                </Surface>
              </Link>
            </div>
          );
        })}
      </div>

      {total > 1 ? (
        <div className="mt-3 flex items-center justify-between gap-2">
          <button type="button" onClick={() => step(-1)} aria-label={t("heroSlidePrev")} className={CONTROL}>
            <ChevronLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
          </button>

          {/* Dots are BUTTONS with names, not decoration: each one is a real
              destination. 24px hit targets around a 6px mark. */}
          <div className="flex min-w-0 flex-wrap items-center justify-center gap-0.5">
            {slides.map((slide, i) => {
              const active = i === index;
              return (
                <button
                  key={slide.id}
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-label={t("heroSlideGoTo", { name: slide.name })}
                  aria-current={active ? "true" : undefined}
                  className="u-focus group grid h-6 w-6 shrink-0 place-items-center rounded-pill"
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "h-1.5 w-1.5 rounded-pill bg-white transition-opacity duration-hover ease-standard",
                      active ? "opacity-100" : "opacity-45 group-hover:opacity-75",
                    )}
                  />
                </button>
              );
            })}
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {/* Withdrawn under reduced motion: with no automatic rotation there
                is nothing to pause, and a control that does nothing is worse
                than none. */}
            {reducedMotion ? null : (
              <button
                type="button"
                onClick={() => setStopped((value) => !value)}
                aria-label={stopped ? t("heroCarouselPlay") : t("heroCarouselPause")}
                className={CONTROL}
              >
                {stopped ? (
                  <Play className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Pause className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            )}
            <button type="button" onClick={() => step(1)} aria-label={t("heroSlideNext")} className={CONTROL}>
              <ChevronRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
