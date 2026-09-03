import * as React from "react";
import { PackageSearch } from "lucide-react";
import { cn } from "@avenick/utils";

/**
 * ImageFrame — the single highest-impact component in the system, and it is not
 * an effect. It is framing.
 *
 * THE PROBLEM, STATED PRECISELY. Product cards used `aspect-square` plus
 * `object-cover` on SELLER-SUPPLIED photography. On a marketplace, images arrive
 * at every crop, every background tone and every product-in-frame ratio. Cover
 * on a square crops a bottle's neck off one card and leaves a fitting swimming
 * in grey on the next, and twenty-four of those read as a scraped feed. Apple,
 * Nike and Mejuri do not have this problem because they own their photography.
 * Avenick does not, and never will.
 *
 * Three decisions, each load-bearing:
 *
 *   CONTAIN, NOT COVER. Cover crops the valve off a fitting and the label off a
 *   drum. It looks tidy in a mockup with three curated photos and broken with
 *   four hundred real supplier uploads.
 *
 *   4:5, NOT 1:1. Portrait is the ratio the editorial grids settled on; square
 *   reads as a thumbnail contact sheet. Seller and admin override the ratio to
 *   1:1 at token level — that is inventory and operations, not merchandising.
 *
 *   THE CAST FLOOR. The radial pooled under the product is what stops a cut-out
 *   packshot looking like it is hovering. On hover the product lifts off that
 *   floor while the floor stays put.
 *
 * THE ABSENCE OF AN IMAGE IS A DESIGNED STATE, NOT A FALLBACK. Same frame, same
 * plate, same floor, plus a mark and the SKU in mono. It occupies the identical
 * box, so a grid mixing presence and absence has no ragged baseline.
 *
 * This is a Server Component and it takes no Next dependency: pass `src` and it
 * renders a plain <img>, or pass a next/image element as `children` and it
 * frames that instead. `grep -rn "object-cover" apps/` must return zero on any
 * surface holding supplier photography.
 */
export type ImageFrameRatio = "card" | "hero";
export type ImageFrameState = "available" | "out" | "unconfirmed";

export interface ImageFrameProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Image URL. Omit to render the designed no-image state. */
  src?: string | null;
  /** Required whenever `src` is given. Never a filename, never "product image". */
  alt?: string;
  /** Shown in mono in the no-image state. A first-class comparison attribute
   *  for a procurement audience, and shown nowhere else in the product today. */
  sku?: string;
  ratio?: ImageFrameRatio;
  /** `out` desaturates rather than scrimming: a full-card scrim makes the
   *  unavailable product the loudest thing in the grid. */
  state?: ImageFrameState;
  /** Forwarded to the plain <img>. Ignored when `children` is supplied. */
  sizes?: string;
  loading?: "eager" | "lazy";
  fetchPriority?: "high" | "low" | "auto";
  /** A framework <Image>. Rendered in place of the plain <img>. */
  children?: React.ReactNode;
}

export const ImageFrame = React.forwardRef<HTMLDivElement, ImageFrameProps>(function ImageFrame(
  {
    src,
    alt = "",
    sku,
    ratio = "card",
    state = "available",
    sizes,
    loading = "lazy",
    fetchPriority,
    className,
    children,
    ...props
  },
  ref,
) {
  const hasImage = Boolean(children) || Boolean(src);

  return (
    <div
      ref={ref}
      className={cn("u-imgframe", className)}
      data-ratio={ratio === "hero" ? "hero" : undefined}
      data-state={state === "out" ? "out" : undefined}
      {...props}
    >
      {children ??
        (src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={alt}
            sizes={sizes}
            loading={loading}
            fetchPriority={fetchPriority}
            decoding="async"
          />
        ) : null)}

      {!hasImage && (
        <div className="u-imgframe__void" aria-hidden="true">
          <PackageSearch className="h-6 w-6" strokeWidth={1.25} />
          {sku && <span className="u-mono u-meta">{sku}</span>}
        </div>
      )}
    </div>
  );
});
