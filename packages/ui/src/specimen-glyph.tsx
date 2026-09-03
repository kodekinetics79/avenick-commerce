import * as React from "react";

/**
 * A drawn specimen for a listing that carries no photograph.
 *
 * 383 products are live with zero images, so the frame's fallback is not a rare
 * edge case — it is most of the catalogue, and a bare icon over a SKU made the
 * grid read as broken rather than as unphotographed. This draws a technical
 * plate instead: dimension rules, an isometric solid, annotation ticks. It is
 * unmistakably a DRAWING, which is the point — it must never be mistaken for a
 * photograph of the product, because it is not one. A register that has not yet
 * received a photograph shows a schematic, the way a catalogue printed before
 * the plates arrived shows a line cut.
 *
 * The motif is chosen from the SKU, so a grid of twenty unphotographed products
 * is twenty different drawings rather than one repeated twenty times, and the
 * same product draws the same plate on every render and on the server and the
 * client alike — a random pick would hydrate differently and flash.
 */
const MOTIFS = 4;

/** Small deterministic hash. Not security; only needs to be stable and spread. */
function motifFor(seed: string): number {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) | 0;
  }
  return Math.abs(hash) % MOTIFS;
}

export interface SpecimenGlyphProps extends React.SVGProps<SVGSVGElement> {
  /** Usually the SKU. Anything stable for this product works. */
  seed?: string;
}

export function SpecimenGlyph({ seed = "", className, ...props }: SpecimenGlyphProps) {
  const motif = motifFor(seed);
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      role="presentation"
      aria-hidden="true"
      className={className}
      {...props}
    >
      {/* Dimension rules — the same brass the register uses for its section
          marks, at the opacity of a drafting guide rather than a decoration. */}
      <g stroke="hsl(var(--brass))" strokeOpacity="0.5" strokeWidth="0.75">
        <path d="M14 100h92" />
        <path d="M14 96v8M106 96v8" />
        <path d="M14 20v72" strokeDasharray="2 4" strokeOpacity="0.3" />
      </g>

      {/* The solid. Isometric, drawn in ink so it inherits the theme. */}
      <g stroke="currentColor" strokeOpacity="0.55" strokeWidth="1.25" strokeLinejoin="round">
        {motif === 0 && (
          <>
            <path d="M60 26 96 46v34L60 100 24 80V46z" />
            <path d="M60 26v34l36 20M60 60 24 80" strokeOpacity="0.3" />
          </>
        )}
        {motif === 1 && (
          <>
            <rect x="30" y="38" width="60" height="48" rx="4" />
            <path d="M30 54h60M46 38v48" strokeOpacity="0.3" />
            <circle cx="60" cy="70" r="9" strokeOpacity="0.45" />
          </>
        )}
        {motif === 2 && (
          <>
            <circle cx="60" cy="60" r="27" />
            <circle cx="60" cy="60" r="14" strokeOpacity="0.4" />
            <path d="M60 33v54M33 60h54" strokeOpacity="0.25" strokeDasharray="3 4" />
          </>
        )}
        {motif === 3 && (
          <>
            <path d="M36 84V44l24-14 24 14v40" />
            <path d="M36 44l24 14 24-14M60 58v26" strokeOpacity="0.3" />
          </>
        )}
      </g>

      {/* Annotation ticks: the plate is measured, which is what makes it read as
          a technical record rather than an empty box. */}
      <g stroke="currentColor" strokeOpacity="0.22" strokeWidth="0.75">
        <path d="M20 30h6M20 40h4M20 50h6M20 60h4" />
      </g>
    </svg>
  );
}
