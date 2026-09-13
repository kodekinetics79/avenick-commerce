import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge, taught this design system's type scale.
 *
 * Out of the box tailwind-merge recognises a `text-*` class as a FONT SIZE only
 * when it is one of Tailwind's own steps (`text-xs` … `text-9xl`, `text-base`)
 * or an arbitrary length. Every other `text-*` value falls through to the
 * colour group, because a colour name can be anything. The type scale in
 * packages/config/tailwind.config.base.js is not Tailwind's steps: it is
 * `text-micro`, `text-ui`, `text-body`, `text-h2`, `text-fig-card` and the rest,
 * so plain twMerge filed every one of them as a colour, and two colours in one
 * class list collapse to the last one.
 *
 * That dropped real classes in both directions, silently, in all three portals:
 *
 *   · colour, then size — `bg-primary text-primary-foreground px-5 text-ui` came
 *     back as `bg-primary px-5 text-ui`. That is the primary Button's own variant
 *     plus its own size, so every filled button's label lost its foreground
 *     token and inherited ink instead: 3.4:1 on the green in light theme, 1.6:1
 *     in dark. Every other Button variant and size lost its text colour the
 *     same way.
 *   · size, then colour — `text-meta … text-primary-ink` came back without
 *     `text-meta`. That is Badge's base plus its own variant, so badges rendered
 *     at whatever size their parent happened to be. cart/_money-path.tsx had
 *     already hit this and switched to `u-ui` to get round it.
 *
 * The list below is the keys of `theme.extend.fontSize`, verbatim. It is
 * written out rather than required from the config because this module ships
 * in client bundles, and cn.regression.test.ts reads the config and fails the
 * moment the two disagree.
 *
 * Joining the font-size group brings its one conflict with it: a custom size
 * now removes an EARLIER `leading-*` in the same list, exactly as `text-sm`
 * always has, because the scale's utilities set their own line-height. A
 * `leading-*` written AFTER the size is kept. No call site in the three portals
 * wrote one before a size when this changed.
 */
const merge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: [
            "micro",
            "meta",
            "ui",
            "body",
            "lead",
            "h3",
            "h2",
            "h1",
            "display",
            "hero",
            "fig-inline",
            "fig-card",
            "fig-section",
            "fig-hero",
          ],
        },
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return merge(clsx(inputs));
}
