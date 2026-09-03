# SIJILL (سجل) — the Avenick design system

**A trade register held up to the light.**
One overhead light, five depths, four optical events per slab. A warm ruled ground that
drifts. Type with six times the range it had. Exactly one enormous thing per screen — made
desirable entirely out of records the database actually holds, never out of a claim.

This is the reference. If you are building a surface in `apps/customer`, `apps/seller` or
`apps/admin`, everything you need is here. If you need something this system does not
offer, the fix is a PR to `packages/ui` — never a local
`<div className="rounded-2xl border border-border bg-card shadow-sm">`, never a page-local
`<style>` block, never a hex in a component, and never a page that becomes `"use client"`
to get an animation.

SIJILL is Meridian's second movement. **Every name, every token and every law from round
one survives.** What changed is range: the type ladder gained a rung 6.1× the body size,
the dark surface ladder widened from a 10-point L span to 13, the ambient field went from
measurably invisible to felt and moving, and the light model went from one part to four.

---

## 0. What was wrong the first time, and what is wrong now

**Round one's diagnosis was right.** `--background` and `--card` were both `0 0% 100%`, so
a card was a 1px border and a radius. That is fixed and stays fixed.

**Round one's ceiling was range.** Everything ended up within one order of magnitude of
everything else — a 52px display against 15px body is 3.5×, and a system with no dynamics
is not restrained, it has no dynamics. The field measured `.055` alpha on a white ground,
which is below perceptual threshold: the product's one atmospheric gesture was doing
literally nothing. And every animation in the file was a single element changing a single
property. Documents have transitions; **products have choreography** — two or more elements
moving in a stated relationship over time.

**"Impressive" is almost entirely a scale problem, not a decoration problem.** That is why
this round is mostly numbers and framing, and very little new ornament.

Three defects were shipping and are fixed here, each in its own place below: `--ink-3` had
~3% contrast headroom and failed the instant the field became visible; the skeleton shimmer
swept against the reading direction in Arabic; and `--font-provenance` was Source Serif 4,
which has **zero Arabic coverage**, so the Arabic build's most human voice fell back
silently and had none.

---

## 1. The laws

Round one's five, unchanged, plus one that this round makes explicit.

**LAW A — DEPTH IS SEMANTIC.**
> Raised = actionable. Recessed = context or input. Flat = content.

You never ask a designer which rung to use; you ask *"is this thing clickable?"* and look
it up. **One rung-3 surface per viewport, maximum.**

**LAW B — ONE LIGHT, OVERHEAD, ZERO X-OFFSET.**
Every shadow has `0` horizontal offset. Every specular is on the top edge. The underside is
always *darker* than the surface, never lighter. **This is the invariant the entire system's
RTL correctness rests on** — an overhead light is identical in both reading directions, so
nothing needs mirroring. The new fresnel ring is symmetric about the vertical axis for
exactly this reason. Do not make it asymmetric to "add interest".

**LAW C — RANK BEFORE POLISH.**
A metric's figure is at least 3× its label. Weights are 400 / 500 / 600. Two exemptions,
both narrow and both set in CSS rather than by a class: a hero-rank numeral at 700, and
`.u-hero` at 680 (see §2.2 for why that one is principled rather than a relaxation).

**LAW D — MOTION IS A READOUT, NEVER A GATE.**
Nothing moves on its own except the field and a loading shimmer. Press lands in 160ms.
Every animation is interruptible — no queues, no `pointer-events: none` windows. The state
has already changed; the animation only reports it.

**LAW E — TRUTH IS A DESIGNED ELEMENT.**
`<Dateline>` promotes provenance to a first-class line: a publication cites its sources.
`<EmptyState>` gets the most care in the system, because in a product that may not invent
data, an honest empty surface has to read as *deliberate*.

**LAW F — WHEN A LAYOUT HAS A HOLE IN IT, THE ANSWER IS A BETTER EMPTY STATE, NEVER A
PLAUSIBLE NUMBER.** This outranks everything else in this document.

> The hero has a specimen slot. The supplier card has a seal. Every one of them looks
> better full, and a ratings row, a "trusted by" strip, a 4.8 average, a "2,400+ suppliers"
> or a "24h response" is available in five minutes. **Every one of them is unsurvivable.**
> Every technique in SIJILL is the presentation of something the database already holds — a
> photograph, a price, a break quantity, a category count, a reviewed trade licence, a
> status. The moment a technique requires inventing a rating, a count, a logo or a promise,
> **the technique is wrong for this product and must be dropped, however good it looks.**

---

## 2. Where things live

| | |
|---|---|
| **All tokens, surfaces, motion CSS, utilities** | `packages/ui/src/globals.css` — the only place. Plain CSS, no `@apply`. |
| **App stylesheets** | `apps/*/src/app/globals.css` — an `@import` of the above, the three `@tailwind` lines, and the portal's posture. Nothing else. |
| **Tailwind surface of the tokens** | `packages/config/tailwind.config.base.js` |
| **Primitives** | `packages/ui/src/*.tsx`, all exported from `@avenick/ui` |
| **Arabic display faces** | `apps/*/src/app/layout.tsx`, `<link>` gated on `locale === "ar"` |

**LAW 9 — NO CALLABLE HELPER FROM A `"use client"` MODULE.** Next replaces every export of
a client module with a client reference in the server graph. A component survives that; a
plain function does not, and calling one fails the *production* build with a minified
`TypeError` naming no file. Variant functions and styling helpers live in a module with no
directive. `packages/ui/src/__tests__/client-boundary.regression.test.ts` polices it.

---

## 3. Tokens

HSL values are bare triples (`H S% L%`) so every one composes with alpha:
`hsl(var(--ink-1) / .06)`. **Every token has a dark value. A token defined only on `:root`
is a bug.**

### 3.1 Surfaces

| token | light | dark | job |
|---|---|---|---|
| `--surface-0` | `36 20% 97.5%` | `232 18% 4%` | page ground |
| `--surface-1` | `36 16% 95.4%` | `232 14% 8.5%` | rung 1 — recessed: inputs, thead, wells |
| `--surface-2` | `0 0% 100%` | `232 13% 11%` | rung 2 — the card |
| `--surface-3` | `0 0% 100%` | `232 12% 15%` | rung 3 — raised |
| `--surface-float` | `36 20% 99%` | `232 14% 16%` | rung 4/5 base |
| `--surface-sunken` | `36 18% 93%` | `232 18% 4.5%` | deep well |

**Changed this round:** dark `--surface-0` 6% → **4%**, dark `--surface-3` 14% → **15%**.
Range between the darkest ground and the brightest object is where dark-mode expense comes
from; a 10-point L span across five rungs is a gradient nobody can see.

### 3.2 Ink

`--ink-1` body + headings · `--ink-2` secondary sentences · `--ink-3` **labels and metadata
only, never a sentence** · `--ink-inv`.

**`--ink-3` changed and this shipped before anything else.** Light `220 10% 46%` →
**`220 11% 41%`**; dark `226 9% 58%` → **`226 10% 65%`**. The old light value was 4.63:1 on
`--surface-0` and 4.06:1 the moment any tint sat behind it — roughly 3% of headroom, and a
guaranteed failure the instant the field became visible. The old dark value measured 4.09:1
on dark glass over the brightest field point, which was already a fail. It is every label,
table caption and metadata line in three portals.

### 3.3 Lines

`--hairline` is a rule **inside** a surface. `--border` is the **edge** of one.
`--border-strong` is the 2px underrule beneath a table head or section title. One token
drawing all three jobs is why dense tables read as boxes inside boxes.

### 3.4 The four-part light model — NEW, and it ships to all three portals

A physical slab under an overhead source shows four optical events. Round one had one.

| part | token(s) | what it is |
|---|---|---|
| 1. **Highlight** | `--rim`, `--rim-2/3/4` | the 1px top seam where the source hits the edge |
| 2. **Fresnel shoulder** | `--rim-shoulder-2/3/4` | the highlight fading *around* the perimeter |
| 3. **Counter-fresnel** | `--fresnel-under`, `--fresnel-alpha` | the dark underside seam, opposite the source |
| 4. **Contact** | `--contact`, `--contact-alpha` | the tight shadow where the slab meets the ground |

Parts 3 and 4 live inside `--elev-3`, `--elev-4` and `--elev-5`. **Rungs 0, 1 and 2 are
unchanged** — rung 2 is content, and content does not need an underside.

Part 2 is the one `box-shadow` cannot draw, because it must fade *around* the perimeter. It
is a masked conic ring on `[data-rim]::before`, exposed as `rim` on `<Surface>`, defaulting
**on at rungs 3–5 and off at 0–2**. The conic is symmetric about the vertical axis (0deg
equals 360deg, 68deg mirrors 292deg), so it is byte-identical in Arabic and uses `--dir`
nowhere. `@supports not (mask-composite: exclude)` falls back to a flat inset ring at half
strength.

In dark mode the **counter-fresnel is the strongest of the four**: with almost no light to
catch, the underside seam is what separates one near-black slab from another. It is pure
black there rather than the hue-matched value, because at `.34` a tinted underside reads as
a colour cast.

Portal dials: `--rim-shoulder-3` is `.48` customer, `.38` seller, `.30` admin.

### 3.5 Elevation — `--elev-0` … `--elev-5`

Five rungs, written out in full per theme. In dark, depth is carried by the surface
lightening plus the top rim-light; the drop shadow is secondary. **Never copy a light-mode
shadow stack into the dark block.** Never animate `box-shadow` — cross-fade a stacked
`::after` that statically carries the rung.

### 3.6 Glass — two materials

| | `[data-glass="true"]` (chrome) | `[data-glass="display"]` (display) |
|---|---|---|
| where | bars, dropdowns, drawers, modals | customer only, **one per route** |
| carries text? | **yes** — contrast is deterministic | **no body text**: headings ≥24px, figures ≥20px only |
| blur | `--blur-float` 20px / `--blur-modal` 28px | `--blur-display` 34px light, 30px dark |
| saturate | `--sat-glass` **1.60 light / 1.30 dark** | `--sat-display` 1.34 / 1.10 |
| alpha | `--glass-alpha` .86 / .84 | `--display-alpha` .58 / .46 |

`--sat-glass` in dark changed 1.60 → **1.30**: above roughly 1.4 a blurred *dark* backdrop
goes neon, because saturate multiplies chroma and there is little luminance left to hold it
down. 1.60 was tuned on the light theme and copied.

**Fixed live defect:** both materials now set `--ring-offset-surface` locally. Without it,
the two-stop focus ring inside a glass bar painted the *inherited page rung* as its inner
stop, producing a visibly mismatched halo around every focused control on glass.

Both materials carry the counter-fresnel, so glass is not the one material with a top edge
and no underside.

**Budget: ≤3 blurred surfaces per viewport on customer (of which ≤1 is display), ≤2 on
seller/admin, never nested, never on a container taller than the viewport, never on a card.**
A card that blurs the field behind it is a card whose price contrast depends on where the
field happened to have drifted. `<Surface>` throws in development on `glass` below rung 4,
on `glass="display"` outside `data-portal="customer"`, and on a second display plate in the
DOM.

`prefers-reduced-transparency: reduce` takes both opaque at `--surface-float`. Honour it,
but it is **not Baseline and cannot be the accessibility story** — the alpha floor is.

### 3.7 The ruled field — the identity

The single permitted ambient gradient, mounted **exactly once** per root layout by
`<AmbientField>`.

```
--field-a: 248 66% 58%   alpha .075 light / .16 dark   indigo — brand
--field-b: 184 64% 44%   alpha .052 light / .11 dark   verdigris — trade
--field-c:  36 56% 42%   alpha .026 light / .07 dark   brass — the register    (NEW)
--field-rule / --field-rule-alpha   .035 light / .045 dark
--field-noise  .022 light / .034 dark        --field-blur 64px
--field-intensity  1 customer · .30 seller · .15 admin
```

**Three hues, never four.** Overlapping lobes past three mix to brown rather than glow.
This is documented behaviour, not taste.

**Every alpha is a CEILING, derived from composited contrast at the worst three-lobe
overlap, in both themes, at both extremes of the drift keyframes.** A contrast measurement
taken from a stationary screenshot at t=0 is meaningless for a field that moves. At these
values light `--ink-3` holds 4.70:1 and light `--brass-ink` 4.53:1; dark `--ink-3` holds
5.27:1 and dark `--ink-2` 6.53:1. **Raise one and every label in three portals fails, in a
state that only appears seventeen seconds into a thirty-four second cycle.**

Structure: `.u-field` (fixed, `inset: -18vh -18vw`, `contain: layout style paint`) holds
two `.u-field__lobe` children that drift on **34s and 47s — coprime, so they never visibly
re-sync**, which is what stops it reading as a loop. The drift is a `transform` on a
pre-painted layer, never `background-position` and never gradient stops, both of which
repaint every frame.

**The ruling** is on the parent and unblurred, under the grain: a
`repeating-linear-gradient` of 1px hairlines at exactly `--lh-body`, masked by a radial so
they dissolve by 76%. Measured delta against the ground is 1.07:1 — felt, never read.
Horizontal by construction, therefore identical in Arabic. **Rules are horizontal only, at
exactly `--lh-body`, and they never reach a paragraph.** Not a dot grid. Not a cross-hatch.

**Grain** is a tiled `background-image` from `--noise`, at `--field-noise`, ×0.7 above
2dppx. The data URI carries `stitchTiles='stitch'` (removes the visible 160px seam round one
had) and `feColorMatrix saturate 0` (**mandatory** — raw `fractalNoise` is *chromatic* and
puts red-green speckle over a warm ground, which reads as a dirty screen). `numOctaves` 3,
never higher. Reusable on any plate via `[data-grain]`.

### 3.8 State layers — `color-mix`, retiring ~40 drifting tokens

```
--state-hover: 8%   --state-press: 16%
--state-mix: var(--ink-1) light  →  var(--ink-inv) dark      /* one line */
```

Because oklab lightness is perceptually uniform, the same percentage produces the same
perceived shift at every hue — the thing that never worked in HSL. Use `.u-state` on a
surface you own and `.u-state-wash` on one you do not (a table row, a nav item).

### 3.9 Imagery

```
--img-ratio-card: 4 / 5     (seller & admin: 1 / 1)
--img-ratio-hero: 3 / 2
--img-inset:      9%        (seller: 5% · admin: 0)
--img-plate:      var(--surface-1)
```

### 3.10 Brand, semantics, focus, shape, density

Unchanged from round one. `--brass` still has exactly three permitted uses — the
active-indicator rule, tier marks, verification marks — and a ≤2% viewport-pixel budget.
There is deliberately no brass fill, soft or gradient.

**There are no glow tokens. `--glow-*` stays undefined.** The Tailwind remap of
`shadow-glow` to a hue-matched elevation rung stays. The only luminous thing in the product
is brass, and brass is a rule, a tier mark or a seal — never a fill, never a halo, never a
button.

### 3.11 Gradient interpolation

**Append `in oklab` to every hue-crossing gradient.** sRGB interpolation passes indigo →
verdigris through a muddy grey midpoint; oklab does not. ~87% support, silent sRGB fallback
which is exactly what ships today. Free quality, zero token churn.

---

## 2.2 · TYPE

### The Latin scale

| step | size | line-height | tracking | weight |
|---|---|---|---|---|
| micro | 11px | 16px | +.06em | 600 caps |
| meta | 12px | 18px | 0 | 400 |
| ui | 13px | 20px | 0 | 500 |
| body | 15px | 24px | 0 | 400 |
| lead | `clamp(16px, .930rem + .29vw, 19px)` | 1.58 | −.004em | 400 |
| h3 | `clamp(19px, 1.118rem + .29vw, 22px)` | 1.32 | −.009em | 600 |
| h2 | `clamp(24px, 1.314rem + .76vw, 32px)` | 1.14 | −.016em | 600 |
| h1 | `clamp(30px, 1.550rem + 1.33vw, 44px)` | 1.08 | −.022em | 600 |
| display | `clamp(34px, 2rem + 2.2vw, 52px)` | 1.05 | −.026em | 600 |
| **hero** | **`clamp(40px, 1.293rem + 4.95vw, 92px)`** | **0.98** | **−.034em** | **680** |

Figures: `fig-inline` 20/28/500 · **`fig-card` 22/26/600 (NEW)** · `fig-section` 30/34/600 ·
`fig-hero` 46/48/700, all at `--tr-fig` −.02em. `fig-card` exists because 20px is a
dashboard stat size, not a shopfront price, and a price is the first thing a shopper's eye
lands on.

h1/h2/h3 and the lead became **fluid**: a fixed 34px h1 is enormous on a 390px phone and
timid on a 27-inch monitor. Every clamp is computed for a 390 → 1440 range, not eyeballed.

### Families

```
@import ... family=Inter:opsz,wght@14..32,400..700 ...
```

Inter's **optical-size axis is live** (a bogus axis 404s; this one returns variable faces).
The previous request pulled four *static* cuts, which is why the display steps read as a
body face scaled up. `opsz` is literally the difference between Inter and Inter Display, in
one file, and `body { font-optical-sizing: auto }` makes it automatic.

`--font-sans` Inter · `--font-display` Inter (opsz does the display work — **no second Latin
family, and therefore no second decision to get wrong**) · `--font-mono` IBM Plex Mono (SKUs,
order refs, tracking IDs — **never money**) · `--font-provenance` Source Serif 4 italic.

### Why 680 is permitted where round one banned 700

The ban existed to protect typographic **colour**. A static 700 at 92px has the
stroke-to-counter ratio of a 16px label and reads as a UI element somebody zoomed. At
`"opsz" 32`, weight 680 at 92px has approximately the stroke-to-counter ratio that 600 has
at opsz 14 and 26px — the same typographic colour. **The optical-size axis is what makes the
exemption principled rather than a relaxation.** 680 exists on exactly one class, `.u-hero`.
Everywhere else the ceiling is still 600, and 800/900 do not exist.

### Two free wins

`text-wrap: balance` on `.u-hero`, `h1`, `h2` — removes the single-word last line, the
loudest amateur tell in a large headline. `text-wrap: pretty` on prose — removes the orphan.
Both Baseline, both zero cost. **Under RTL both become `pretty`**: `balance` produces odd
breaks on a connected script.

`text-box: trim-both cap alphabetic` on `.u-hero`, `h1`, `h2` — **`[dir="ltr"]` only, and
this is not a preference.** `cap alphabetic` describes Latin metrics; trimming an Arabic
line to them clips the ascenders on ا and ل. Firefox ignores it and you get a pixel or two
of extra leading, the most graceful degradation in CSS.

### Hierarchy is SEVEN levers, not two

**Size, weight, tracking, colour, family, case, space-before.** Round one built rank from
size and colour alone, which is why the page reads as an even grey field.

> **Three levers minimum between adjacent ranks, and the levers must DIFFER between rank
> pairs.** hero→h2 by size + weight + tracking + opsz. h2→body by size + colour + space.
> body→meta by size + colour + case. **If two adjacent ranks differ only in size, they are
> the same rank and one of them should be deleted.**

**THE ACCEPTANCE TEST:** blur the page until no word is legible. If you can still tell which
block is the headline, which is a section and which is metadata, the levers are engaged. If
it reads as an even grey field, no gradient will save it.

---

## 2.3 · ARABIC — three registers, matched by script register

**The single largest gap in round one, and it was invisible to an English reviewer.** Latin
had three registers; Arabic had one face doing all three jobs. Worse, `--font-provenance`
was Source Serif 4, which has **zero Arabic coverage** — so every `<Dateline>` and every
`<EmptyState>` lead, the two places the system deliberately puts its most human voice, fell
back silently to Plex Arabic. The English page had a voice and the Arabic page had none.
That is the textbook definition of translated-looking.

**The pairing rule, and it is the load-bearing decision: match across EQUIVALENT SCRIPT
REGISTERS, never by mood.** Latin neo-grotesque ↔ Arabic Kufi (both constructed,
architectural, official). Latin serif ↔ Arabic Naskh (both authored, high-contrast,
traditional). Pair across a register boundary — a Latin serif against a Kufi Arabic — and
the English page reads as a magazine while the Arabic page reads as an airport sign, and
neither reads as the same company.

| register | Latin | Arabic | why |
|---|---|---|---|
| display | Inter @ opsz 32 | **Noto Kufi Arabic** | Kufi is the script of official inscription, of the stamp and of the seal. For a trade **register** that is the correct register, not a stylistic preference. |
| body | Inter | IBM Plex Sans Arabic | a correct body face and a weak display face; this round stops asking it to be both |
| provenance | Source Serif 4 italic | **Noto Naskh Arabic**, upright | Naskh *is* Arabic's authored register |

Rejected for display: a calligraphic face (dissonant against a neo-grotesque Latin), Cairo
(its Latin is markedly weaker than its Arabic, and mixed strings happen constantly on a
marketplace), Readex Pro (technically the most interesting dual-script family on Google
Fonts, but its temperament is open and reading-optimised — wrong for a ledger a procurement
manager reconciles at 11pm).

**Loading:** the base `@import` in `globals.css` carries Latin + Plex Arabic. The two Arabic
faces are a `<link rel="stylesheet">` emitted from each root layout **gated on
`locale === "ar"`**, so the English build never pays for them. A stylesheet cannot be
conditional; a layout can.

### The Arabic scale — its own ramp, not Latin plus 7%

Set at token level in the `[dir="rtl"]` block: body 16/26, ui 14/22, meta 12.5/20, micro
11.5/18, h3 21/31, h2 `clamp(26px,…,34px)`/1.32, h1 `clamp(32px,…,47px)`/1.26, display
`clamp(34px,…,66px)`/1.30.

### THE CONSTRAINT THAT SETS BOTH HERO NUMBERS

```
Latin   92px × 0.98 = 90.2px per line
Arabic  76px × 1.20 = 91.2px per line
```

**The two languages occupy the same vertical band.** Arabic is not capped out of timidity
and not inflated out of guilt; the two scales are solved together so one hero composition
holds in both languages, and the CTA sits at the same fold on a 1366px laptop either way.

> **This is the single number in this document most likely to be "corrected" by someone who
> does not read Arabic.** Set Arabic to 92 at line-height 1.20 and each line becomes 110px,
> the headline block grows 22%, and the CTA drops below the fold on the 1366px laptops that
> are a large share of Gulf desktop traffic. Set it to 92 at Latin's 0.98 and Naskh
> ascenders and Kufi diacritics collide with the line above.

`--fw-hero` is **600** in RTL, not 680: Plex Arabic and Noto Kufi are static on Google
Fonts, 680 does not exist there, and asking for it is a synthesis request.

### The five things that actually make it native

1. **NEVER TRACK ARABIC.** Zeroed at token level (`--tr-*: 0`), including the new
   `--tr-hero` and `--tr-lead`. Arabic is a connected script; tracking of either sign breaks
   the joins, worse in Kufi than in Naskh. Do not hand-write `tracking-tight` on a heading.
2. **NEVER SYNTHESISE.** `[dir="rtl"] { font-synthesis: none }` — fail loudly rather than
   smear a weight the face does not have. `[dir="rtl"] :is(em,i,cite) { font-style: normal;
   font-weight: 500 }` — Arabic has no italic, and obliquing to fake one is the mark of a
   product that did not look.
3. **NO CASE, NO CAPS-TRACKING.** `.u-micro` drops `uppercase` and tracking under RTL. This
   already worked and must survive; extend it to any new eyebrow-shaped class.
4. **MIXED-SCRIPT SIZE.** A Latin brand name inside an Arabic title renders ~15% optically
   smaller — the clearest tell that nobody looked. `font-size-adjust: from-font` on
   `h1,h2,h3,p,.u-body,.u-lead` under RTL, behind `@supports`.
5. **ONE NUMERAL SYSTEM, WESTERN, EVERYWHERE.** See §11 — this is a live defect in
   `packages/utils/src/currency.ts` and it is **not** owned by this package.

### RTL construction rules for every new surface

Zero x-offset on every shadow. `grid-column`, `inset-inline-*`, `ms/me/ps/pe`,
`text-start/text-end`, `border-s/border-e` only. Every directional transform multiplies by
`--dir`. `transform-origin` uses `--origin-inline-start`.

**AND THE NEW ONE, because SIJILL introduces masks and gradients where round one had almost
none:** `mask-image` and `linear-gradient` take **physical** directions and do not mirror,
and neither does a conic origin at `22% 12%`. Every one of them passes English review and
ships broken in Arabic. **Two mechanisms, both mandatory:**

- **(a) multiply the ANGLE** — `linear-gradient(calc(90deg * var(--dir)), …)` mirrors any
  linear gradient with no second rule. Same for a conic `from` and a percentage origin:
  `at calc(50% + (28% * var(--dir))) 12%`.
- **(b) make edge masks SYMMETRIC** — `linear-gradient(to right, transparent 0, #000 20px,
  #000 calc(100% - 20px), transparent 100%)` is direction-agnostic by construction.

Where neither is possible (`clip-path: inset()` has no logical form), write both directions
out explicitly, as `.u-wipe` does.

**Fixed live example:** the skeleton shimmer was `translateX(-100%) → translateX(100%)` over
a `linear-gradient(90deg, …)`. Both physically LTR, so in Arabic the light swept against the
reading direction. Now `calc(-100% * var(--dir))` and `calc(90deg * var(--dir))`.

---

## 4. Portal posture — one system at three intensities, not three looks

Selected by `<html data-portal>`. **The storefront and the console share every OBJECT and
differ only in INTENSITY, RATIO and DENSITY.** A supplier reading a settlement and an
operator approving a payout are not audiences for spatial UI; a buyer choosing between two
suppliers is.

| dial | customer | seller | admin |
|---|---|---|---|
| `--field-intensity` | 1 | .30 | .15 |
| `--motion-scale` | 1 | **.85** | **.65** |
| `--rim-shoulder-3` | .48 | .38 | .30 |
| `--img-ratio-card` / `--img-inset` | 4/5 · 9% | 1/1 · 5% | 1/1 · 0 |
| `--radius` / `--row-h` / `--space-section` | 14 / 44 / 72 | 10 / 36 / 40 | 8 / 32 / 32 |
| `--fs-hero` | the hero rung | `= --fs-h1` | `= --fs-h1` |
| reveals | on | on | **off** |

`--motion-scale` had existed since round one and **always resolved to 1 in practice**. It is
wired now, which is the cheapest possible portal differentiation.

**Crosses all three unconditionally — this is the spine:** the four-part light model and
`[data-rim]`; `<ImageFrame>`; `<AvailabilityDot>`; `<PriceStack>` and the `.fig` tabular
treatment; the Certificate `<EmptyState>`; the focus ring, `<LedgerTable>`, the `.u-drawn`
brass rule, `.u-commit`, `<Layer>`; the corrected reduced-motion contract; the RTL shimmer
fix; the `--ink-3` change; the symmetric edge mask on any horizontal scroller; the
sticky-bar settle.

**Customer-only, and the list is closed:** `.u-hero` / `--fs-hero`, `<HeroStage>` and its
planes, display glass, the field at full intensity, the animated seal, `<DisplayPlate>`,
`<LightGrid>`, `<Rail>`.

**The enforcement is structural, not by review.** `[data-portal="seller"],
[data-portal="admin"] { --fs-hero: var(--fs-h1) }` makes the hero rung unavailable rather
than discouraged. `<Surface>` throws on `glass="display"` outside customer.
`[data-portal="admin"] [data-reveal] { animation: none !important }` stops a scroll timeline
reintroducing reveals a console deliberately does not have.

> **The single fastest way to break this direction is for someone to "turn the field up so
> it's visible on admin too."** The effect dies behind tables and forms, and this product has
> two entire portals that ARE tables and forms.

---

## 5. Budgets

Every one of these is enforceable by grep or by a dev-time throw. **The budgets are the only
thing that stops the second half of a round undoing the first half.**

| thing | budget |
|---|---|
| rung-3 surfaces | 1 per viewport |
| blurred surfaces | ≤3 customer (≤1 display) · ≤2 seller/admin · never nested |
| ambient field | **1 per root layout. Never a second, never a page-local one.** |
| hero stage | **1 per site**, 3 planes maximum |
| display glass | 1 per route, customer only |
| animated seal | 1 per viewport, iteration count **1** |
| grained / ruled elements | ≤3 per viewport, never on a scroller or a table |
| pointer-tracked specular surfaces | 8–12 per viewport, **zero on table rows** |
| `<LightGrid>` children | tracked to 24, then a 1.5× viewport band |
| quantity ladder bands on a tile | 3, and never a scrollbar |
| brass | ≤2% of viewport pixels |
| stagger | 40ms, capped at 6 items, **1 group per viewport-height** |
| infinite animations | **exactly two in the entire product**: the field drift and the skeleton shimmer |

---

## 6. Primitives

### 6.1 New this round

**`<ImageFrame>`** — `src?` · `alt` · `sku?` · `ratio?: "card" | "hero"` · `state?:
"available" | "out" | "unconfirmed"` · `sizes?` · `loading?` · `fetchPriority?` · `children?`

> **THE FIRST THING TO BUILD, and the highest-ROI change in the direction — and it is not an
> effect, it is framing.** Product cards used `aspect-square` + `object-cover` on
> seller-supplied photography. On a marketplace, images arrive at every crop, tone and
> product-in-frame ratio: cover on a square crops the valve off a fitting and leaves a drum
> swimming in grey, and twenty-four of those read as a scraped feed. Apple and Nike do not
> have this problem because they own their photography. Avenick does not, and never will.
>
> `object-fit: contain` is **non-negotiable**. 4:5 portrait reads as considered; square
> reads as a thumbnail contact sheet. The cast floor at `50% 93%` is what stops a cut-out
> packshot looking like it is hovering, and on hover the product lifts off that floor while
> **the floor stays put** — one composited transform, and the reason the card feels physical
> rather than styled. Scale ceiling 1.035.
>
> **The absence of an image is a designed state, not a fallback**: same frame, same plate,
> same floor, plus a `PackageSearch` mark and the SKU in mono, occupying the identical box.
>
> **Out of stock is NOT a full-card scrim** — that makes the unavailable product the loudest
> thing in the grid. It is `grayscale(.55) opacity(.72)` on the image plus an
> `<AvailabilityDot>`.
>
> **Every product image in all three portals goes through it**: card, PDP gallery, cart
> line, wishlist, RFQ line, order line, seller listing table, admin thumbnail. Consistency
> of scale, margin and plate treatment across a grid is the measured lever in premium
> commerce, not effects.
>
> It takes no Next dependency: pass `src` for a plain `<img>`, or a `next/image` element as
> `children`. **`grep -rn 'object-cover' apps/` must return zero on any surface holding
> supplier photography.**

**`<HeroStage>` / `<HeroCopy>` / `<HeroSpecimen>`** — `planes?: 1 | 3` · `midPlane?` ·
`backPlane?` · `as?`

> The 12-column asymmetric editorial hero as three composable pieces, so no surface team
> hand-rolls a hero. Copy is `1 / span 7`, specimen `9 / span 4` above 1024px, both
> `span 12` below. `grid-column` is logical, so the composition mirrors in Arabic with zero
> extra CSS.
>
> **Raising `--fs-hero` is the cheapest half of the change and the half that does not work
> alone.** A 92px headline over a near-empty ground with a 15px lead and no specimen is a
> bigger version of the current problem. **Ship the grid and the specimen or do not ship the
> type.**
>
> The **front plane stays in normal document flow** and carries every word, price and
> control; only the decorative planes are taken out of flow. That is what makes the stage's
> height content-driven, keeps `contain: paint` from ever clipping a headline, and means the
> composition is simply a grid if no animation runs.
>
> `<HeroSpecimen>` holds **one real product** from the catalogue fetch the page already
> does. If the catalogue is empty it holds
> `<EmptyState variant="certificate" scale="hero">`. **Never a placeholder product, never
> stock photography, never a rating.**

**`<DisplayPlate>`** — `grain?` · `ruled?` · `rim?`
The generated object: a mirrored conic + radial field in the product's own hues, ruled
ground, grain, shoulder rim, real shadow. Abstract but physical, honest because it claims
nothing. Customer only, one per route.

**`<PriceStack>`** — `amount` · `qualifier?` · `vat?` · `secondary?` · `rank?: "card" | "inline"`

> Replaces the inline `<Num rank="inline">` on cards. **The qualifier ("From") is a `.u-meta`
> run BESIDE the figure, never baked into the string** — baked in, it rendered at the
> figure's own rank and collapsed law C's 3× ratio at exactly the place a shopper looks
> first. **The currency mark lives inside the figure run**, never superscripted, never a
> different colour: a raised or coloured currency mark is discount-retail signalling.
>
> B2C: inclusive amount, `vat="Incl. VAT"`. B2B: exclusive amount, `vat="Excl. VAT"`,
> `secondary` = the computed inclusive figure. **UAE FTA rules require consumer prices to be
> VAT-inclusive with an explicit exception for VAT-registered businesses provided the
> exclusion is stated.** That is not a styling preference — it is why the two price blocks
> must be visibly different objects, and the asymmetry is what makes the B2B surface feel
> like a more serious product.
>
> Takes **strings**, never message keys and never numbers: `packages/ui` stays locale-free.

**`<QuantityLadder>`** — `tiers` · `activeQty?` · `max?` (default 3) · `caption` · `headers`

> A real `<table>` with an sr-only `<caption>` and `scope="col"` headers, because it is
> tabular data and a screen-reader user must be able to navigate it by column. The
> inline-start rule is **always 3px and always present**; only its colour changes, so
> marking a band cannot reflow the tile. Brass on the active band, because "the tier you are
> in" is literally a tier mark. **Renders nothing for a single-price product.** Gate it on
> `isB2B` — a consumer seeing wholesale breaks is a pricing leak.

**`<AvailabilityDot>`** — `state: "IN_STOCK" | "OUT_OF_STOCK" | "UNCONFIRMED"` · `label`
6px dot with a 3px ring at ~15% alpha (the ring is what makes a 6px dot read as a lamp
rather than a full stop). **Colour is never the only channel** — the label is required. One
stock language in three portals.

**`<EdgeFade>` / `<Rail>`** — `prevLabel` · `nextLabel` · `label`
The symmetric inline mask and the proximity-snapping horizontal rail, with real keyboard
prev/next buttons carrying aria-labels. Hiding a scrollbar without an alternative affordance
is an accessibility regression.

**`<FacetRail>`** — `label` · `options` · `defaultOpen?` · `renderOption?`
Counted facets in `<details>`/`<summary>`, so open/close needs no client component. Chevron
drawn from two rotated borders — nothing to mirror. **Counts must be real: omit the count
rather than approximate it,** because a wrong count is a lie any user can falsify by
clicking it.

**`<LightGrid>`** (client) — `itemSelector?`
ONE `pointermove` listener on a grid container that writes `--mx/--my` per child from each
child's own rect in a single rAF flush, so the cards read as one lit material. Copies
`<SpecularSurface>`'s guard shape verbatim: early-returns *before attaching* on coarse
pointer, reduced motion and Save-Data. **Never wrap a table.**

**`<EnvironmentFlags>`** (client)
Reads `navigator.connection?.saveData` once and stamps `data-save-data` on `<html>`. Law 7
names Save-Data and no shipping browser exposes it as a CSS media query.

**`<ScrollProgress>`**
The brass reading hairline, `scaleX` on a scroll timeline, zero JS. Long documents only.

### 6.2 Extended — existing APIs are backwards compatible

**`<Surface>`** — adds `rim?: boolean` (default on at rungs 3–5) and widens `glass` to
`boolean | "display"`. New dev-time throws for display glass outside customer and for a
second display plate.

**`<TierMark>`** — adds `verified` + **REQUIRED `basis: string`**, `showBasis?`.
> **It throws in development if `verified` is passed without `basis`, and returns null in
> production.** A brass arc travelling around a badge that says "Verified" with no reviewed
> `SellerDocument` behind it is a fabricated trust signal rendered in CSS — precisely what
> gets added in a hurry because a supplier card looked empty. `basis` is the citation:
> "Trade licence reviewed 14 Feb 2026", from a row with `status === APPROVED` and a real
> `reviewedAt`. **Do not make it optional "for now."**
>
> The seal is `tabIndex={0}` deliberately: the arc runs on `:focus-visible` as well as
> `:hover`, so a keyboard user reaches the same gesture. **Iteration count is one.** Never
> infinite.

**`<EmptyState>`** — adds `variant?: "default" | "certificate"` · `scale?: "default" | "hero"`
· `glyph?`. The default variant is unchanged, so all 117 existing call sites keep their box.
The certificate variant **throws without an `action`**. It also lost its `"use client"`
directive, which it never needed.
> **The marketplace move, and it is fully true:** when a category is empty, the one action is
> the RFQ route. *"No supplier lists this yet — request a quote"* turns the emptiest surface
> in the product into its most differentiated one.

**`<AmbientField>`** — now renders the two drift lobes; the ruling and grain are its
`::before`/`::after`. Still mounted **exactly once**.

**`<StickyGlassBar>`** — adds `settle?` (default true). Continuous scroll-timeline
condensation, IntersectionObserver kept as the fallback.
> **To get the padding half of the settle, remove the vertical padding utility from the
> bar.** Tailwind utilities out-rank `.u-chrome`'s `padding-block`, so a `py-3` on the header
> silently wins.

**`<SpecularSurface>`** — the fill is now two coupled layers plus a tighter brass border ring.
> **Fixed:** it set `will-change: transform` on a wrapper that never transforms, promoting a
> compositor layer for zero benefit and costing memory on exactly the mid-range Android this
> product must serve. The rAF throttle and the two early-returns were already correct and
> are untouched. **For a grid, use `<LightGrid>` instead.**

**`<CommitRow>` / `useCommitState()`** — adds `<CommitBadge>` (`pulseKey`, `tone`) and
`<CommitLabel>` (`idle`, `committed`, `done`). Presentation only; still does not wrap,
replace, delay or gate the server action, the permission check or the validation.

**Skeletons** — adds `SkeletonImageFrame`, `SkeletonProductCard`, `SkeletonProductGrid`,
`SkeletonHero`, `SkeletonLadder`. Each occupies the same box as the thing it replaces, and
`SkeletonImageFrame` reuses the real frame so the plate is already lit before the photograph
arrives.

**`<Reveal>` / `<RevealRoot>` / `<Num>`** — **UNCHANGED.** Base state visible, hidden only
after a confirmed below-fold check: strictly safer than a scroll timeline, and not being
replaced by one. `<Num>` stays the structural guarantee that digits are never the animated
element.

### 6.3 Not built, deliberately

No `<TransitionLink>` / view-transition morph. No `<Tilt>`. No `<Marquee>`. No `<CountUp>`.
No `<GradientText>`. No `<Glow>`. **If a PR adds one, the review answer is a link to this
document, not a discussion.**

---

## 7. Utilities and their budgets

| class | what | budget |
|---|---|---|
| `.u-hero` | the 92px display rung | customer only |
| `.u-hero-grid` / `.u-hero-copy` / `.u-hero-specimen` | the 12-column composition | 1 per site |
| `.u-stage` / `.u-plane[data-z]` | bounded 3D, Z-position only | 1 stage, 3 planes |
| `.u-imgframe` | the product frame | unlimited |
| `.u-seal` | the travelling brass arc | 1 animated per viewport |
| `.u-empty` | the Certificate plate | 1 per empty region |
| `.u-plate` | the generated display object | 1 per route, customer |
| `.qty-ladder` | the quantity-break table | 3 bands on a tile |
| `.u-dot` | availability lamp | unlimited |
| `.u-edge-fade-inline` / `.u-rail` | symmetric mask + proximity rail | — |
| `.u-facet` / `.u-facet__chev` | JS-free disclosure | — |
| `.u-chrome` | the settling bar | 1 per document |
| `.u-scroll-progress` | brass reading hairline | 1 per document |
| `.u-badge-pulse` / `.u-wipe` | the commit gestures | — |
| `.u-state` / `.u-state-wash` | oklab state layers | unlimited |
| `.u-pop` | `@starting-style` popover entry | — |
| `[data-rim]` | the fresnel shoulder | unlimited |
| `[data-grain]` / `[data-rule-ground]` | texture and ruling | ≤3 per viewport, never on a scroller or a table |

Round one's `.u-drawn`, `.u-commit`, `.u-meter-*`, `.u-layer-*`, `.u-field`, `.u-micro`…
`.u-display`, `.u-provenance`, `.u-mono`, `.u-measure*` are all unchanged in name and
behaviour.

---

## 8. Motion vocabulary

### Easing

| token | curve | job |
|---|---|---|
| `--ease-out` | `cubic-bezier(.22,1,.36,1)` | entering, exiting — **the default** |
| `--ease-standard` | `cubic-bezier(.32,.72,0,1)` | this IS the iOS drawer curve |
| `--ease-drawer` | alias of standard | so the purpose is legible |
| `--ease-in-out` | `cubic-bezier(.77,0,.175,1)` | **strengthened**; on-screen movement and morphs |
| `--ease-exit` | `cubic-bezier(.4,0,1,1)` | leaving |
| `--ease-overshoot` | `cubic-bezier(.34,1.4,.5,1)` | **renamed from `--ease-spring`**; button press-and-release |
| `--ease-spring` | a sampled `linear()` at 44 points | **the system's one real spring, one job: the commit badge pulse** |

Assignment, not taste: entering/exiting → `--ease-out`. Moving or morphing on screen →
`--ease-in-out`. Hover and colour → plain `ease`. Progress → `linear`. **Never `ease-in` on
UI**: it starts slow at the exact moment the user is watching, and ease-out at 200ms feels
faster than ease-in at 200ms.

Springs are otherwise the **wrong default for this product and that is a feature**. A GCC
trade platform that bounces reads as a consumer app cosplaying as infrastructure.

### Durations

`--dur-1` 90 · `--dur-2` 140 · `--dur-3` 220 · `--dur-4` 320 · `--dur-5` 480 ·
`--stagger` 40, all scaled by `--motion-scale`.

Press 160 · tooltip/popover/dropdown 180 · layer enter 320 / exit 200 · filter crossfade
exit 130 + enter 180 delayed 90 · meter 420 · commit wash 260 · queue drain 180.
**Nothing exceeds 480ms end to end. Hard ceiling for anything the user triggers: 300ms.**

**ASYMMETRY IS THE RULE, NOT AN OPTION.** Exits are faster than entrances and they overlap.
A symmetric 300/300 crossfade is the single most reliable tell of a system that was
configured rather than designed.

### What may animate

`transform` and `opacity`. That is the list. Plus a registered `@property` feeding a
decorative gradient, and `clip-path` on a label swap.

**NEVER:** `box-shadow` · backdrop-filter *radius* · `filter` · `height` ·
`background-position` · gradient stops · **or the digits of any number** — price, count,
total, stock level, settlement figure, status. On a trade platform an animated number is a
number you cannot trust, and every intermediate frame of a ticking figure displays a value
that is false.

### Scroll-driven CSS — for MATERIALS, never for CONTENT

**The split is the architecture.** `animation-timeline: view()/scroll()` runs on the
compositor with zero JS at ~84–90% support, and it is the right tool for making a *material*
respond to scroll: header condensation, the brass progress hairline, hero plane drift. It is
the **wrong** tool for revealing content — a reveal that depends on a timeline firing is
exactly the law-D violation, and `view()` resolves against the **nearest scroll container**,
so any element inside an `overflow: hidden` ancestor gets a timeline that never advances and
sits at opacity 0 forever.

> **THE RULE.** A scroll-driven keyframe may animate the opacity or transform of a
> **decorative** layer, or a registered `@property` feeding a decorative gradient. It may
> **never** animate the opacity or transform of an element containing text, a price, a
> status or a control.

Every scroll-driven rule is wrapped in **both** `@supports (animation-timeline: …)` **and**
`@media (prefers-reduced-motion: no-preference)`, with `animation-fill-mode: both` — without
it, an element already past the range at load sits at intermediate progress forever.

Content reveal stays with `<Reveal>` / `<RevealRoot>`, unchanged.

### Stagger, disciplined

40ms, capped at 6 items. **Never stagger a result set the user requested** — staggering
search results, filter results or a table is the canonical "this site is slow" generator.
Never more than one stagger group per viewport-height. Stagger is decorative and **must
never gate interaction**: every element is clickable at t=0 while its opacity is still
animating.

### Frequency, not surface, ranks motion

- **100+/day** (admin queue keyboard actions, command palette, quantity steppers) → **zero
  animation, ever.** Raycast has no open/close animation at all, deliberately. The instinct
  of every implementer is to animate the command palette because it is the most fun thing on
  the page to animate. It is also the most wrong.
- **Tens/day** (row hover, nav) → drastically reduced, portal-scaled.
- **Occasional** (drawer, modal, toast, filter change) → full choreography.
- **Rare** (first add-to-cart, quote submitted, seller approved) → the only place delight is
  licensed.

### Reduced motion — a designed state, not a degradation

Round one's block was `transition-duration: 1ms !important` on the universal selector, which
also killed every colour, background and opacity transition. **A motion-sensitive user got a
build with no hover feedback of any kind — a worse product than the one the query was
protecting them from** — and the `!important` meant every fade written afterwards was dead
on arrival for them. Roughly one user in twenty gets this path.

The rewritten contract **removes movement and keeps opacity and colour**:

- `--motion-scale: 0`, `--lift-y`, `--press-y`, `--stagger`, `--blur-scrim` all zeroed
- `animation-duration: 1ms !important` (**1ms, not 0** — `transitionend` must still fire or
  the queue-drain unmount hangs forever)
- transforms off on `[data-lift]`, `[data-reveal]`, `[data-layer]`, `.u-imgframe img`,
  `.u-plane`
- the field lobes, the chrome settle and the progress hairline stop
- **the seal parks at 62deg at .6 opacity — still legible as a mark**
- the skeleton goes to a static .5-opacity block
- **and the meaningful fades are given back**: `[data-reveal]` opacity, `.u-commit`, and
  background/colour/border on every link, button, ledger row, state layer and ladder row

**Save-Data:** `<EnvironmentFlags>` stamps `data-save-data`, which halves `--motion-scale`,
stops the drift, drops the grain, hides the decorative hero planes and stops `<LightGrid>`
attaching.

### Pointer gating

Every hover effect and every pointer listener is behind
`@media (hover: hover) and (pointer: fine)`. Touch fires a false `:hover` on tap; without the
gate a card lights up on mobile Safari and stays lit until something else is tapped. **The JS
islands early-RETURN before attaching**, so on a phone the listener is never registered at
all.

---

## 9. Banned outright

Round one's bans are re-affirmed and not relaxed. **Reversing a documented refusal in the
name of impact is a regression dressed as an improvement.**

- **3D pointer tilt on any card, in any portal.** Past ~6° on a 320px card, horizontal type
  acquires colour fringing because subpixel antialiasing does not survive a Z-rotation; the
  cast shadow stops agreeing with the one-overhead-light model, which is the invariant that
  makes the whole system free in Arabic; and it is the most-templated effect of the last
  three years. **Depth arrives as Z-position**, never as rotation.
- **`mix-blend-mode` anywhere.** Blend forces an isolated stacking context and inverts
  meaning between themes. Every effect in SIJILL is plain alpha compositing precisely so it
  behaves identically in both.
- **Magnetic buttons, custom cursors, cursor followers, scroll-jacking, multi-layer parallax
  on text, blocking intros.** A magnetic button moves the hit target away from where the user
  aimed — an accessibility regression wearing a costume.
- **Count-ups, rolling odometer digits, text-scramble headlines.** Text scramble is
  additionally and specifically wrong here: **Arabic glyphs shape contextually, so animating
  per-character produces genuinely malformed letterforms mid-animation.**
- **Apple-style Liquid Glass refraction** via `backdrop-filter: url(#svgfilter)` — Chromium
  only, invisible in Safari and Firefox, and every resize rebuilds the displacement map. What
  *is* portable from it is its three-layer decomposition, and that is what §3.4 builds out of
  `box-shadow` and a masked conic.
- **Restoring `.text-gradient`, the even 1px white ring on all four sides of a glass card, or
  any neon glow utility.** All three were deliberately removed with reasons, and all three
  are precisely what an "add more impact" brief tends to reintroduce.
- **A second ambient field, or a page-local one.** Two stacked fields double the alpha on
  that page only, which is the visible-orb failure the single field exists to avoid, and it
  silently breaks every contrast ceiling in §3.7.
- **A fourth field hue.** Past three, overlapping lobes mix to brown rather than glow.
- **A bento grid on the storefront hero.** Bento is right for the B2B dashboard and the
  account overview, where tile size can reflect real data priority. On a marketing hero it is
  where a marketplace starts inventing content to fill tiles.
- **An auto-scrolling marquee for the category strip.** It moves content the user is trying
  to read. Use `<Rail>`.
- **Infinite idle animation of any kind** beyond the two named in §5.
- **A literal English string in JSX.** Every user-visible string comes from the next-intl
  tree. This is the defect that shipped last round.
- **framer-motion arriving for a fade, or a page becoming `"use client"` to get one.**

---

## 10. The ways this ships badly

Round one's eleven, plus the ones this round creates.

1. **The field gets turned up until someone can see it in a screenshot.** See §3.7. A
   measurement at t=0 on a stationary screenshot is meaningless for a field that moves.
2. **The ruled ground becomes a dot grid, or the rules survive into the content area.** The
   ruling is the identity and it is one gradient away from being the most generic thing on
   the page.
3. **Grain goes on everything, or goes on wrong** — `filter: url(#grain)` on a live element;
   grain inside a `[data-glass]` subtree; omitting `feColorMatrix saturate 0`; omitting
   `stitchTiles`.
4. **`object-fit: cover` survives somewhere** — the cart line, the wishlist tile, the RFQ
   line, the order line, the seller listing thumbnail, the PDP related rail. **One frame with
   cover in a row of nine with contain is worse than nine with cover**, because it announces
   that the system is not actually a system.
5. **The seal ships without its basis, or idles.** One prop away from the unsurvivable
   failure.
6. **The hero gets 92px type and nothing else changes.**
7. **Somebody "fixes" the Arabic hero by making it 92px too.** See §2.3.
8. **A new mask or gradient ships with a physical direction.** This is the defect class this
   round will actually produce. See §2.3's two mandatory mechanisms.
9. **Reduced motion gets "fixed" by making it more aggressive.** Do the opposite.
10. **The spotlight goes on a table row, or per-card instead of per-grid.**
11. **The empty state stays a centred grey apology because it is "just" an empty state.** It
    is the surface the owner is actually looking at. **Build it before the field, before the
    hero, before anything animated.** And the failure inside the failure: giving it
    compositional weight with a stock illustration — a purple isometric person holding a box
    — or a lucide icon centred at 96px.
12. **The hole in a beautiful layout gets filled with fiction.** Law F. **This is the only
    one that ends the project.**
13. **Ten new signatures instead of one extended one.** The system's genuine advantage is
    that it has ONE gesture — the brass rule drawn from the inline start. The seal, the
    progress hairline, the ladder's active band, the commit rule and the certificate's top
    edge are all **the same brass rule in different postures**, and they are built as such. A
    twelfth agent inventing a sixth brass gesture with its own timing curve is how a system
    stops reading as designed and starts reading as assembled.

---

## 11. Not owned by this package — cross-track requests

**`packages/utils/src/currency.ts` — the numeral defect.** `formatCurrency` maps AED →
`ar-AE` (Western digits) but SAR → `ar-SA`, QAR → `ar-QA`, KWD → `ar-KW`, BHD → `ar-BH`,
OMR → `ar-OM`, and every one of those five returns **Arabic-Indic** (`١٬٢٣٤٫٥٠`).

An Arabic cart holding an AED line and a SAR line therefore prints **two numeral systems in
the same column**; `font-variant-numeric: tabular-nums` does nothing for Arabic-Indic digits
in Plex Arabic, so the column cannot align; and IBM Plex Mono has no Arabic-Indic coverage at
all, so an order reference falls back to a system face mid-string.

**Fix: append `-u-nu-latn` to all six Arabic locale strings.** This is a **bug fix, not a
behaviour change** — `<Num>`'s own docstring already states the policy ("Prices stay in
Western digits in both locales — GCC commerce convention, and a deliberate decision"), and
the code violates its own stated intent for five of seven currencies. Flag it to the owner
anyway, because it is the one item that touches a formatter.

**`apps/customer/package.json` — framer-motion, and `three` / `@react-three/fiber`.** Both
changes are **blocked on a lockfile update**, which this track cannot perform: CI runs
`pnpm install --frozen-lockfile`, and any edit to a `package.json` that `pnpm-lock.yaml` does
not match fails the install step for every other agent. See the handover note.

---

## 12. Worked example — a category grid, correct

```tsx
// A Server Component. It never becomes "use client".
import {
  ImageFrame, PriceStack, AvailabilityDot, QuantityLadder,
  EmptyState, LightGrid, Surface, Eyebrow, Dateline,
} from "@avenick/ui";
import { getTranslations } from "next-intl/server";

export default async function CategoryGrid({ products, isB2B }) {
  const t = await getTranslations("catalogue");

  // LAW F. The hole gets a designed object, never a plausible number.
  if (products.length === 0) {
    return (
      <EmptyState
        variant="certificate"
        eyebrow={t("empty.eyebrow")}
        headline={t("empty.headline")}
        body={t("empty.body")}
        // The marketplace move: the emptiest surface becomes the most
        // differentiated one, and it is completely true.
        action={<a className="u-focus …" href="/b2b/rfq/new">{t("empty.requestQuote")}</a>}
      />
    );
  }

  return (
    // ONE pointermove listener for the whole grid, not one per card.
    <LightGrid className="grid grid-cols-2 gap-stack md:grid-cols-3 lg:grid-cols-4">
      {products.map((p) => (
        <Surface key={p.id} rung={2} interactive specular focusLift
                 as="article" className="group overflow-hidden">
          <a href={`/products/${p.slug}`} className="u-focus block">
            {/* contain, 4:5, inset, cast floor, designed no-image state */}
            <ImageFrame
              src={p.imageUrl}
              alt={p.name}
              sku={p.sku}
              state={p.inStock ? "available" : "out"}
              sizes="(max-width: 768px) 50vw, 25vw"
            />
            <div className="p-3">
              {/* The SKU replaces the rating slot. It is a first-class
                  comparison attribute for a procurement audience, and the
                  catalogue has no reviews — printing "No reviews yet" 24 times
                  turns the grid into a wall of absence. */}
              <span className="u-mono u-meta text-ink-3">{p.sku}</span>
              <h3 className="u-h3 mt-1 text-ink-1">{p.name}</h3>

              <PriceStack
                className="mt-2"
                amount={p.priceFormatted}
                qualifier={p.priceTiered ? t("from") : undefined}
                vat={isB2B ? t("vat.excl") : t("vat.incl")}
                secondary={isB2B ? p.priceInclFormatted : undefined}
              />

              <AvailabilityDot
                className="mt-1.5"
                state={p.stockState}
                label={t(`stock.${p.stockState}`)}
              />

              {/* Gated on isB2B: a consumer seeing wholesale breaks is a
                  pricing leak. Renders nothing for a single-price product. */}
              {isB2B && (
                <QuantityLadder
                  className="mt-2"
                  tiers={p.tiers}
                  caption={t("ladder.caption")}
                  headers={{ qty: t("ladder.qty"), unitPrice: t("ladder.unit") }}
                />
              )}
            </div>
          </a>
        </Surface>
      ))}
    </LightGrid>
  );
}
```

**What is deliberately absent:** any rating, any review count, any "HOT"/"NEW" badge, any
discount theatre, any delivery promise. **A storefront that cannot lie has to be beautiful
instead**, and depth-and-light is the one currency that costs no truth. What replaces the
usual levers is **density of true fact where a template would put white space**: the SKU, the
availability dot, the quantity ladder, real facet counts. McMaster-Carr has no visual design
to speak of and is universally described as premium, because every pixel is load-bearing
information.

### Deciding a rung, in one question

> Is this thing clickable? → **3+**. Is it context or an input? → **1**. Is it content? →
> **0 or 2**.

### Never nest an interactive element inside an anchor

The card above wraps its content in one `<a>`. A wishlist button inside it would be a
nesting violation — put it **outside** the anchor, absolutely positioned over the frame, with
its own `aria-label`.
