"use client";

import * as React from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { AvailabilityDot, EdgeFade, ImageFrame, Surface, type StockState } from "@avenick/ui";
import { FOCUS_INSET } from "./product-facts";

export type GalleryImage = {
  url: string;
  altEn?: string | null;
  altAr?: string | null;
};

/**
 * The gallery, and the single largest cheapness generator in the product before
 * this change: `aspect-square` + `object-cover` on seller-supplied photography.
 * Cover crops the valve off a fitting and the label off a drum, and it did it
 * differently on every one of four hundred supplier uploads. Every image on this
 * page now goes through <ImageFrame> — the same plate, the same cast floor, the
 * same overhead light, the same 9% inset, `object-fit: contain` — so a gallery
 * and a product tile read as one shelf rather than as two scrapes.
 *
 * OUT OF STOCK IS NOT A SCRIM. The old overlay darkened the photograph and put a
 * pill in the middle of it, which made the unavailable product the loudest thing
 * on the page. ImageFrame desaturates instead, and the availability dot beside
 * the frame carries the fact in words — colour is never the only channel.
 *
 * ALT TEXT COMES FROM THE SUPPLIER'S OWN altEn/altAr. The catalogue has carried
 * both since the DTO was written and the page was throwing them away and
 * substituting the product name on every frame, which is how a gallery of six
 * photographs announces itself six identical times.
 */
export function ProductGallery({
  images,
  productName,
  sku,
  availability,
  availabilityLabel,
  locale,
}: {
  images: GalleryImage[];
  productName: string;
  sku: string;
  availability: StockState;
  availabilityLabel: string;
  locale: "en" | "ar";
}) {
  const t = useTranslations("pdp.gallery");
  const [active, setActive] = React.useState(0);
  const strip = React.useRef<HTMLDivElement>(null);

  // A gallery whose selected index outlives its image list points at nothing.
  React.useEffect(() => {
    setActive((current) => (current < images.length ? current : 0));
  }, [images.length]);

  const current = images[active];
  const altFor = (image: GalleryImage | undefined) =>
    (locale === "ar" ? image?.altAr : image?.altEn) || image?.altEn || productName;

  /**
   * Roving arrow-key selection across the strip, which is what a set of
   * mutually-exclusive choices owes a keyboard user: one tab stop for the
   * group, arrows to move within it. The horizontal arrows are read through the
   * document direction, because in Arabic the "next" thumbnail is the one to
   * the LEFT.
   */
  function onStripKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const rtl = typeof document !== "undefined" && document.documentElement.dir === "rtl";
    const forward = event.key === "ArrowDown" || event.key === (rtl ? "ArrowLeft" : "ArrowRight");
    const backward = event.key === "ArrowUp" || event.key === (rtl ? "ArrowRight" : "ArrowLeft");
    if (!forward && !backward) return;
    event.preventDefault();
    const next = forward
      ? Math.min(images.length - 1, active + 1)
      : Math.max(0, active - 1);
    setActive(next);
    strip.current?.querySelectorAll<HTMLButtonElement>("button")[next]?.focus();
  }

  const thumbs = images.map((image, index) => (
    <button
      key={`${image.url}-${index}`}
      type="button"
      onClick={() => setActive(index)}
      aria-label={t("select", { index: index + 1, total: images.length })}
      aria-pressed={active === index}
      // One tab stop for the group: the arrow keys move within it.
      tabIndex={index === active ? 0 : -1}
      // Opacity and border only. Box-shadow is never animated in this system —
      // it repaints the element every frame — and the selected edge is a border
      // rather than a Tailwind ring because `ring-*` compiles to a box-shadow
      // and would replace the rung's elevation outright.
      className={`${FOCUS_INSET} w-16 shrink-0 overflow-hidden rounded-nested border transition-opacity duration-hover ease-standard ${
        active === index ? "border-primary opacity-100 shadow-elev-2" : "border-border opacity-70 hover:opacity-100"
      }`}
    >
      <ImageFrame alt="">
        <Image src={image.url} alt="" width={64} height={80} sizes="64px" />
      </ImageFrame>
    </button>
  ));

  return (
    <div className="flex flex-col gap-stack">
      {/* The frame is the CARD ratio — 4:5 portrait — deliberately, not the hero
          3:2. Portrait is the merchandising ratio every product tile in this
          storefront already uses, so a buyer arriving from the grid lands on the
          same shape at a larger scale rather than on a differently-cropped
          object; and on a six-column slot it fills the column's own height
          instead of leaving a third of the composition empty under it.
          rim is off: rung 2 is content, and content does not need shoulders —
          the frame supplies its own plate, cast floor and overhead light. */}
      <Surface rung={2} className="overflow-hidden">
        <ImageFrame
          sku={sku}
          state={availability === "OUT_OF_STOCK" ? "out" : "available"}
          alt={altFor(current)}
        >
          {current ? (
            // `key` remounts the element on every swap so no frame of the
            // previous photograph survives into the next. That is also why
            // priority is scoped to the FIRST frame: without the guard every
            // thumbnail press would re-declare a high-priority fetch, and the
            // LCP candidate this page is allowed to prioritise is the image the
            // buyer arrives on, not the fifth one they clicked.
            <Image
              key={current.url}
              src={current.url}
              alt={altFor(current)}
              fill
              sizes="(max-width: 1024px) 100vw, 48vw"
              priority={active === 0}
              fetchPriority={active === 0 ? "high" : "auto"}
            />
          ) : undefined}
        </ImageFrame>
      </Surface>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <AvailabilityDot state={availability} label={availabilityLabel} />
        {/* No live region on the position readout: each thumbnail carries
            aria-pressed, which is what announces the change to a screen reader.
            A second announcement of the same fact is noise. */}
        {images.length > 1 ? (
          <span className="fig u-meta text-ink-3">
            {t("position", { index: active + 1, total: images.length })}
          </span>
        ) : images.length === 0 ? (
          <span className="u-meta text-ink-3">{t("empty")}</span>
        ) : null}
      </div>

      {images.length > 1 && (
        <div
          ref={strip}
          role="group"
          aria-label={t("label")}
          onKeyDown={onStripKeyDown}
          className="min-w-0"
        >
          {/* The symmetric inline mask goes on ONLY when the strip can actually
              scroll. Feathering a row of three thumbnails that all fit fades two
              of them for no reason, which reads as a rendering fault rather than
              as a designed edge. The mask is symmetric by construction, so it is
              correct in Arabic with no second rule. */}
          {images.length > 5 ? (
            <EdgeFade className="flex gap-2 overflow-x-auto scrollbar-hide pb-0.5">{thumbs}</EdgeFade>
          ) : (
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-0.5">{thumbs}</div>
          )}
        </div>
      )}
    </div>
  );
}
