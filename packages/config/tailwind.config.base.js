/**
 * MERIDIAN — Tailwind surface of the Avenick design system.
 *
 * Every value here resolves to a CSS custom property defined in
 * packages/ui/src/globals.css. Nothing in this file is a literal colour any
 * more, because a raw hex has no dark-mode counterpart: `success: "#10B981"`
 * with a light-only `soft` and `border` is exactly what blew out on a dark
 * ground before.
 *
 * Three of these mappings deliberately RETUNE keys that already exist in
 * hundreds of call sites, so pages that no track has migrated yet inherit the
 * new system without being edited:
 *   - borderRadius xl / 2xl / 3xl now resolve to the portal's --radius, which
 *     ends the 16-inside-16-inside-24 radius chaos in one line.
 *   - boxShadow card / elevated / glow now resolve to elevation rungs, so the
 *     ~35 files still writing `shadow-glow` get a hue-matched cast shadow
 *     instead of an indigo neon halo.
 *   - fontWeight bold / extrabold / black all resolve to 600. Law C bans 700+
 *     on anything but a hero-rank numeral (which <Num> sets in CSS, not with a
 *     class). Remapping rather than deleting means not one `font-bold` in the
 *     product breaks — they just stop shouting.
 *
 * @type {import('tailwindcss').Config}
 */
module.exports = {
  darkMode: "class",
  content: [],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "system-ui", "sans-serif"],
        arabic: ["var(--font-sans-ar)", "IBM Plex Sans Arabic", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
        // The provenance voice. <Dateline> and <EmptyState> only — it is not a
        // display family, and under [dir="rtl"] it swaps to upright Plex Arabic.
        provenance: ["var(--font-provenance)", "Georgia", "Times New Roman", "serif"],
      },

      colors: {
        // ── The elevation ramp. A card is no longer the same colour as the page.
        surface: {
          0: "hsl(var(--surface-0) / <alpha-value>)",
          1: "hsl(var(--surface-1) / <alpha-value>)",
          2: "hsl(var(--surface-2) / <alpha-value>)",
          3: "hsl(var(--surface-3) / <alpha-value>)",
          float: "hsl(var(--surface-float) / <alpha-value>)",
          sunken: "hsl(var(--surface-sunken) / <alpha-value>)",
        },
        // ── The ink ramp. ink-3 is labels and metadata only, never a sentence.
        ink: {
          1: "hsl(var(--ink-1) / <alpha-value>)",
          2: "hsl(var(--ink-2) / <alpha-value>)",
          3: "hsl(var(--ink-3) / <alpha-value>)",
          inv: "hsl(var(--ink-inv) / <alpha-value>)",
        },
        // ── Two line weights: hairline INSIDE a surface, border as its EDGE.
        hairline: "hsl(var(--hairline) / <alpha-value>)",
        border: "hsl(var(--border) / <alpha-value>)",
        "border-strong": "hsl(var(--border-strong) / <alpha-value>)",
        rim: "hsl(var(--rim) / <alpha-value>)",
        scrim: "hsl(var(--scrim) / <alpha-value>)",

        input: "hsl(var(--input) / <alpha-value>)",
        ring: "hsl(var(--ring) / <alpha-value>)",
        background: "hsl(var(--background) / <alpha-value>)",
        foreground: "hsl(var(--foreground) / <alpha-value>)",

        // Primary CTA. `ink` is the TEXT hue — the fill hue at 11px on a light
        // ground measures about 4.0:1, and it ships on every eyebrow and
        // every "View →" link in the product.
        primary: {
          DEFAULT: "hsl(var(--primary) / <alpha-value>)",
          foreground: "hsl(var(--primary-foreground) / <alpha-value>)",
          ink: "hsl(var(--primary-ink) / <alpha-value>)",
          soft: "hsl(var(--primary-soft) / <alpha-value>)",
          50: "hsl(var(--primary-soft) / <alpha-value>)",
          100: "hsl(var(--primary-soft) / <alpha-value>)",
          200: "hsl(var(--primary) / 0.22)",
          300: "hsl(var(--primary) / 0.35)",
          400: "hsl(var(--primary) / 0.6)",
          500: "hsl(var(--primary) / <alpha-value>)",
          600: "hsl(var(--primary) / <alpha-value>)",
          700: "hsl(var(--primary-ink) / <alpha-value>)",
          800: "hsl(var(--primary-ink) / <alpha-value>)",
          900: "hsl(var(--primary-ink) / <alpha-value>)",
          950: "hsl(var(--primary-ink) / <alpha-value>)",
        },
        // Trade / verified / settled. Deep verdigris, 32° off --success so a
        // "verified" chip and a "paid" chip can never read as the same colour.
        // This replaces the violet that used to pair with indigo in gradients.
        accent: {
          DEFAULT: "hsl(var(--accent) / <alpha-value>)",
          foreground: "hsl(var(--accent-foreground) / <alpha-value>)",
          ink: "hsl(var(--accent-ink) / <alpha-value>)",
          soft: "hsl(var(--accent-soft) / <alpha-value>)",
          50: "hsl(var(--accent-soft) / <alpha-value>)",
          100: "hsl(var(--accent-soft) / <alpha-value>)",
          200: "hsl(var(--accent) / 0.22)",
          300: "hsl(var(--accent) / 0.35)",
          400: "hsl(var(--accent) / 0.6)",
          500: "hsl(var(--accent) / <alpha-value>)",
          600: "hsl(var(--accent) / <alpha-value>)",
          700: "hsl(var(--accent-ink) / <alpha-value>)",
          800: "hsl(var(--accent-ink) / <alpha-value>)",
          900: "hsl(var(--accent-ink) / <alpha-value>)",
        },
        // The entire GCC gesture. Three permitted uses — the active-indicator
        // rule, tier marks, verification marks — and a ≤2% viewport budget.
        // There is deliberately no brass fill, soft or gradient variant.
        brass: {
          DEFAULT: "hsl(var(--brass) / <alpha-value>)",
          ink: "hsl(var(--brass-ink) / <alpha-value>)",
        },
        // Neutral chrome. The old `navy` ramp was ten hardcoded slate hexes with
        // no dark-mode meaning; it now tracks the ink and surface ramps.
        navy: {
          DEFAULT: "hsl(var(--ink-1) / <alpha-value>)",
          50: "hsl(var(--surface-0) / <alpha-value>)",
          100: "hsl(var(--surface-1) / <alpha-value>)",
          200: "hsl(var(--hairline) / <alpha-value>)",
          300: "hsl(var(--border) / <alpha-value>)",
          400: "hsl(var(--border-strong) / <alpha-value>)",
          500: "hsl(var(--ink-3) / <alpha-value>)",
          600: "hsl(var(--ink-2) / <alpha-value>)",
          700: "hsl(var(--ink-2) / <alpha-value>)",
          800: "hsl(var(--ink-1) / <alpha-value>)",
          900: "hsl(var(--ink-1) / <alpha-value>)",
          950: "hsl(var(--ink-1) / <alpha-value>)",
        },

        // ── Semantic states. Each is a four-part set: fill / text-ink / soft
        // wash / rule, with real dark values. `border` is kept as an alias of
        // `rule` because `border-warning-border` already ships.
        success: {
          DEFAULT: "hsl(var(--success) / <alpha-value>)",
          fg: "hsl(var(--success-foreground) / <alpha-value>)",
          foreground: "hsl(var(--success-foreground) / <alpha-value>)",
          ink: "hsl(var(--success-ink) / <alpha-value>)",
          soft: "hsl(var(--success-soft) / <alpha-value>)",
          rule: "hsl(var(--success-rule) / <alpha-value>)",
          border: "hsl(var(--success-rule) / <alpha-value>)",
        },
        warning: {
          DEFAULT: "hsl(var(--warning) / <alpha-value>)",
          fg: "hsl(var(--warning-foreground) / <alpha-value>)",
          foreground: "hsl(var(--warning-foreground) / <alpha-value>)",
          ink: "hsl(var(--warning-ink) / <alpha-value>)",
          soft: "hsl(var(--warning-soft) / <alpha-value>)",
          rule: "hsl(var(--warning-rule) / <alpha-value>)",
          border: "hsl(var(--warning-rule) / <alpha-value>)",
        },
        danger: {
          DEFAULT: "hsl(var(--danger) / <alpha-value>)",
          fg: "hsl(var(--danger-foreground) / <alpha-value>)",
          foreground: "hsl(var(--danger-foreground) / <alpha-value>)",
          ink: "hsl(var(--danger-ink) / <alpha-value>)",
          soft: "hsl(var(--danger-soft) / <alpha-value>)",
          rule: "hsl(var(--danger-rule) / <alpha-value>)",
          border: "hsl(var(--danger-rule) / <alpha-value>)",
        },
        neutral: {
          soft: "hsl(var(--neutral-soft) / <alpha-value>)",
          rule: "hsl(var(--neutral-rule) / <alpha-value>)",
          ink: "hsl(var(--ink-2) / <alpha-value>)",
        },

        // ── Legacy shadcn aliases. Still resolved, still correct, do not add
        // new uses: `bg-card` is `bg-surface-2`, `text-muted-foreground` is
        // `text-ink-3`.
        secondary: {
          DEFAULT: "hsl(var(--secondary) / <alpha-value>)",
          foreground: "hsl(var(--secondary-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted) / <alpha-value>)",
          foreground: "hsl(var(--muted-foreground) / <alpha-value>)",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
        },
        card: {
          DEFAULT: "hsl(var(--card) / <alpha-value>)",
          foreground: "hsl(var(--card-foreground) / <alpha-value>)",
        },
        popover: {
          DEFAULT: "hsl(var(--popover) / <alpha-value>)",
          foreground: "hsl(var(--popover-foreground) / <alpha-value>)",
        },
      },

      // Radius is a portal token — 14px customer, 10px seller, 8px admin.
      // xl / 2xl / 3xl are remapped rather than left at Tailwind's defaults so
      // the thousands of existing `rounded-2xl` call sites follow the portal
      // instead of hardcoding 16px in three different products.
      borderRadius: {
        none: "0px",
        sm: "var(--radius-sm)",
        DEFAULT: "var(--radius-sm)",
        md: "calc(var(--radius) - 4px)",
        lg: "var(--radius)",
        xl: "var(--radius)",
        "2xl": "var(--radius)",
        "3xl": "var(--radius-lg)",
        pill: "var(--radius-pill)",
        // A child's corner is concentric with its parent's, never parallel.
        nested: "max(3px, calc(var(--radius) - 8px))",
      },

      // Five rungs, exactly. The first hand-written shadow-[0_4px_14px…] in a
      // page kills the system, so there is a named token for every legal depth.
      boxShadow: {
        none: "none",
        "elev-0": "var(--elev-0)",
        "elev-1": "var(--elev-1)",
        "elev-2": "var(--elev-2)",
        "elev-3": "var(--elev-3)",
        "elev-4": "var(--elev-4)",
        "elev-5": "var(--elev-5)",
        // The light seam on its own, for an element that needs the material read
        // without a cast shadow.
        seam: "inset 0 1px 0 hsl(var(--rim) / var(--rim-2))",
        // Deprecated aliases, retuned onto the ladder so unmigrated pages
        // inherit the new depth. `glow` is no longer a glow: an indigo halo on a
        // near-black ground reads as a gaming peripheral.
        xs: "var(--elev-2)",
        sm: "var(--elev-2)",
        DEFAULT: "var(--elev-2)",
        card: "var(--elev-2)",
        md: "var(--elev-3)",
        lg: "var(--elev-3)",
        elevated: "var(--elev-3)",
        xl: "var(--elev-4)",
        "2xl": "var(--elev-5)",
        glow: "var(--elev-3)",
        "glow-sm": "var(--elev-3)",
      },

      backdropBlur: {
        float: "var(--blur-float)",
        modal: "var(--blur-modal)",
        scrim: "var(--blur-scrim)",
      },

      backdropSaturate: {
        glass: "var(--sat-glass)",
        modal: "var(--sat-modal)",
      },

      // The type scale as utilities, each carrying its own line-height and
      // tracking so a surface team cannot pair a size with the wrong leading.
      // Tailwind's own text-xs…text-9xl are untouched for compatibility.
      fontSize: {
        micro: ["var(--fs-micro)", { lineHeight: "var(--lh-micro)", letterSpacing: "var(--tr-micro)" }],
        meta: ["var(--fs-meta)", { lineHeight: "var(--lh-meta)" }],
        ui: ["var(--fs-ui)", { lineHeight: "var(--lh-ui)" }],
        body: ["var(--fs-body)", { lineHeight: "var(--lh-body)" }],
        lead: ["var(--fs-lead)", { lineHeight: "var(--lh-lead)" }],
        h3: ["var(--fs-h3)", { lineHeight: "var(--lh-h3)", letterSpacing: "var(--tr-h3)" }],
        h2: ["var(--fs-h2)", { lineHeight: "var(--lh-h2)", letterSpacing: "var(--tr-h2)" }],
        h1: ["var(--fs-h1)", { lineHeight: "var(--lh-h1)", letterSpacing: "var(--tr-h1)" }],
        display: ["var(--fs-display)", { lineHeight: "var(--lh-display)", letterSpacing: "var(--tr-display)" }],
        // Figures. A metric's figure is at least 3× its label — that ratio is
        // the whole of the hierarchy fix, and it lives in these three steps.
        "fig-inline": ["var(--fs-fig-inline)", { lineHeight: "var(--lh-fig-inline)", letterSpacing: "var(--tr-fig)" }],
        "fig-section": ["var(--fs-fig-section)", { lineHeight: "var(--lh-fig-section)", letterSpacing: "var(--tr-fig)" }],
        "fig-hero": ["var(--fs-fig-hero)", { lineHeight: "var(--lh-fig-hero)", letterSpacing: "var(--tr-fig)" }],
      },

      // 700, 800 and 900 do not exist in this product outside a hero-rank
      // numeral, and the Google Fonts request no longer downloads 800/900.
      // These are remapped rather than removed so no existing class breaks.
      fontWeight: {
        normal: "400",
        medium: "500",
        semibold: "600",
        bold: "600",
        extrabold: "600",
        black: "600",
      },

      spacing: {
        row: "var(--row-h)",
        "control-sm": "var(--control-h-sm)",
        "control-md": "var(--control-h-md)",
        "control-lg": "var(--control-h-lg)",
        tight: "var(--space-tight)",
        stack: "var(--space-stack)",
        block: "var(--space-block)",
        section: "var(--space-section)",
      },

      maxWidth: {
        prose: "var(--measure-prose)",
        desc: "var(--measure-desc)",
      },

      transitionTimingFunction: {
        standard: "var(--ease-standard)",
        out: "var(--ease-out)",
        "in-out": "var(--ease-in-out)",
        exit: "var(--ease-exit)",
        // Customer portal only, and exactly two permitted uses. An overshoot
        // curve handed to a dozen agents becomes a bouncy product.
        spring: "var(--ease-spring)",
      },

      // Components never write a raw duration or their own calc(): these four
      // already carry the portal's --motion-scale.
      transitionDuration: {
        press: "var(--t-press)",
        hover: "var(--t-hover)",
        panel: "var(--t-panel)",
        layer: "var(--t-layer)",
      },

      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        // The `float 6s ease-in-out infinite` keyframe that used to live here is
        // deleted. It was an infinite loop on decoration, which law 4 forbids —
        // the only permitted infinite animation in the product is a genuine
        // loading indicator.
      },

      animation: {
        "fade-up": "fade-up var(--t-layer) var(--ease-out) both",
      },

      backgroundImage: {
        "grid-light":
          "linear-gradient(to right, hsl(var(--ink-1) / 0.04) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--ink-1) / 0.04) 1px, transparent 1px)",
        "grid-dark":
          "linear-gradient(to right, hsl(var(--rim) / 0.05) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--rim) / 0.05) 1px, transparent 1px)",
      },

      zIndex: {
        field: "-1",
        sticky: "30",
        layer: "50",
      },
    },
  },
  plugins: [],
};
