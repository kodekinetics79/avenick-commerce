# Meridian — the Avenick design system

**One light. Five depths. Type with rank. Motion that only ever happens because a human caused it.**

This is the reference. If you are building a surface in `apps/customer`, `apps/seller` or
`apps/admin`, everything you need is here. If you need something this system does not
offer, the fix is a PR to `packages/ui` — never a local
`<div className="rounded-2xl border border-border bg-card shadow-sm">`.

---

## 0. What was actually wrong

Not colour. `--background` and `--card` were both `0 0% 100%`, so a card was literally a
1px border and a radius. Every surface in all three portals was the same object at the same
weight, hierarchy was attempted with a 1.2× type ratio plus `font-bold` on nearly every
string, and the three apps carried byte-identical 115-line copies of the same token block.
A month of GMV, a category chip and a value-prop tile rendered at the same weight, because
there was one rung and nothing could be subordinate to anything.

So the fix starts in the token file, not in a component.

---

## 1. The five laws

**LAW A — DEPTH IS SEMANTIC.**

> **Raised = actionable. Recessed = context or input. Flat = content.**

You never have to ask a designer which rung to use. You ask *"is this thing clickable?"*
and look it up. **One rung-3 surface per viewport, maximum.** Elevation is scarce or it
means nothing — if a recessed well appears somewhere that is not context-or-input, or a
raised surface is not clickable, the reader stops trusting the ladder.

**LAW B — ONE LIGHT, OVERHEAD, ZERO X-OFFSET.**
Every shadow in the system has `0` horizontal offset and every specular is on the **top
edge only**. The bottom border is always *darker* than the surface, never lighter. This is
not taste: overhead light is identical in both reading directions, so the system needs no
mirroring in Arabic. A white ring on all four sides (what `.glass` used to do) is both the
most recognisable amateur tell in this genre and silently wrong in RTL.

**LAW C — RANK BEFORE POLISH.**
A metric's figure is at least **3×** its label. Weights are **400 / 500 / 600**; 700 exists
only on a hero-rank numeral, and 800/900 are no longer downloaded. Emphasis comes from
size, colour and depth — never from bold. Shadows plus a uniform grid plus bold-everything
is the same product with more blur.

**LAW D — MOTION IS A READOUT, NEVER A GATE.**
Nothing moves on its own. Press lands in **90ms**. Every animation is interruptible — no
queues, no `pointer-events: none` windows, no disabled intervals. The state has already
changed; the animation only reports it. A second click restarts the confirmation from
wherever it is.

**LAW E — TRUTH IS A DESIGNED ELEMENT.**
This codebase spent a hardening programme removing things that were not true. The residue
currently renders as 11px grey apologies. `<Dateline>` promotes them to a designed
provenance line. **A publication cites its sources.** Stating precisely what a figure is
and is not is what makes the platform look expensive, instead of what makes it look thin.
Correspondingly, `<EmptyState>` gets the most care in the system: in a product that may not
invent data, an honest empty surface has to read as deliberate rather than broken.

---

## 2. Where things live

| | |
|---|---|
| **All tokens, surfaces, motion CSS, utilities** | `packages/ui/src/globals.css` — the only place. Plain CSS, no `@apply`. |
| **App stylesheets** | `apps/*/src/app/globals.css` — an `@import` of the above, the three `@tailwind` lines, and the portal's posture. Nothing else goes in them. |
| **Tailwind surface of the tokens** | `packages/config/tailwind.config.base.js` |
| **Primitives** | `packages/ui/src/*.tsx`, all exported from `@avenick/ui` |

---

## 3. Tokens

HSL values are bare triples (`H S% L%`) so every one composes with alpha:
`hsl(var(--ink-1) / .06)`. **Every token has a dark value. A token defined only on `:root`
is a bug.**

### Surfaces — light is warm paper (hue 36), dark is cool ink (hue 232)

| Token | Light | Dark | Use |
|---|---|---|---|
| `--surface-0` | `36 20% 97.5%` | `232 16% 6%` | page ground — **tinted**, which is what lets a white card read as catching light |
| `--surface-1` | `36 16% 95.4%` | `232 14% 8.5%` | rung 1, recessed: inputs, `<thead>`, wells |
| `--surface-2` | `0 0% 100%` | `232 13% 11%` | rung 2, the card |
| `--surface-3` | `0 0% 100%` | `232 12% 14%` | rung 3, raised — in light the shadow does the separating |
| `--surface-float` | `36 20% 99%` | `232 14% 16%` | rung 4/5 base, used at alpha under blur |
| `--surface-sunken` | `36 18% 93%` | `232 18% 4.5%` | deep well: code blocks, disabled tracks |

### Ink — cool near-black on warm paper, warm off-white on ink

`--ink-1` body and headings · `--ink-2` secondary sentences · `--ink-3` **labels and
metadata only, never a sentence** · `--ink-inv`.

Pure white is not used for dark-mode text: it halates on ink.

### Lines — two weights, and they are not interchangeable

`--hairline` is a rule **inside** a surface. `--border` is the **edge** of one.
`--border-strong` is the 2px underrule beneath a head or a section title. One token drawing
all three jobs is why dense tables read as boxes inside boxes.

### Physics

`--rim` (specular colour, white in both themes) · `--rim-2` / `--rim-3` / `--rim-4` (its
alpha per rung — `.72/.88/1` light, `.05/.075/.10` dark) · `--shadow` (hue-matched, **not
black**; black reads as soot).

### Elevation — `--elev-0` … `--elev-5`

Written out in full, **twice, once per theme**. Not derived from a multiplier: CSS cannot
multiply into a shadow's alpha without `color-mix()` gymnastics that fail silently, and an
invisible dark-mode shadow is exactly how a good direction ships as a flat dark theme.

**In dark mode the mechanism inverts**: depth is carried by the surface lightening plus the
top rim-light, and the drop shadow is secondary. Never copy a light stack into dark.

### Glass

`--glass-bg` `--glass-alpha` (.86 light / .84 dark) · `--glass-border`
`--glass-border-alpha` · `--modal-alpha` (.96) · `--blur-float` 20px · `--blur-modal` 28px ·
`--blur-scrim` 4px · `--sat-glass` 1.60 · `--sat-modal` 1.75 (without `saturate()` blurred
colour goes grey and dirty) · `--scrim` `--scrim-alpha`.

### Brand

`--primary` `--primary-foreground` `--primary-ink` `--primary-soft` ·
`--accent` `--accent-foreground` `--accent-ink` `--accent-soft` ·
`--brass` `--brass-ink`.

`--primary-ink` exists because indigo **fill** as 11–13px text measures about 4.0:1 on a
light ground, and it ships on every product-card eyebrow and every "View →" link. Every
semantic colour has the same split.

### Semantics — four-part sets

`--success` / `-ink` / `-soft` / `-rule` / `-foreground`, and the same for `--warning`,
`--danger`, plus `--neutral-soft` / `--neutral-rule` / `--neutral-ink`.

Success sits **32° off** accent so a "verified" chip and a "paid" chip can never read as
the same colour, and every hue is desaturated — the neon triad was half of the cheap read.

### Ambient field — the only gradient in the system

`--field-a` `--field-a-alpha` · `--field-b` `--field-b-alpha` · `--field-noise` ·
`--field-intensity` (portal).

### Focus

`--ring` · `--ring-width` · `--ring-offset-surface`. **Re-declare `--ring-offset-surface`
locally on any rung-1, rung-4 or rung-5 surface** so the two-stop ring's inner stop matches
the ground it is drawn on. `<Surface>` and `<FieldWell>` already do.

### Type

Families: `--font-sans` (Inter) · `--font-sans-ar` (IBM Plex Sans Arabic) ·
`--font-provenance` (Source Serif 4 italic — Dateline and EmptyState **only**) ·
`--font-mono` (IBM Plex Mono — SKUs, order refs, tracking IDs, hashes; **never money**).

`--font-mono` was referenced by the Tailwind config and defined in no stylesheet, so every
price on the platform fell through to a different monospace face per operating system.

Steps, each with its own `--fs-` / `--lh-` / `--tr-`: `micro` 11 · `meta` 12 · `ui` 13 ·
`body` 15 · `lead` 17 · `h3` 20 · `h2` 26 · `h1` 34 · `display` clamp(34 → 52).

Figures, which carry the rank ratio: `fig-inline` 20/500 · `fig-section` 30/600 ·
`fig-hero` 46/700.

Weights: `--fw-body` 400 · `--fw-ui` 500 · `--fw-head` 600. **800 and 900 do not exist.**

### Motion

`--ease-standard` (the workhorse) · `--ease-out` (entrances) · `--ease-in-out` (symmetric
swaps) · `--ease-exit` (departures) · `--ease-spring` (customer only, two permitted uses).

`--dur-1` 90 · `--dur-2` 140 · `--dur-3` 220 · `--dur-4` 320 · `--dur-5` 480 ·
`--stagger` 40 · `--motion-scale`.

**Components never write a raw duration or their own `calc()`.** Use the four derived
tokens, which already carry the portal's scale: `--t-press` `--t-hover` `--t-panel`
`--t-layer`, or the Tailwind classes `duration-press|hover|panel|layer`. Nothing in the
product exceeds 480ms end to end.

Also `--lift-y` (−2px) · `--press-y` (0.5px).

### Direction

`--dir: 1`, and `[dir="rtl"] { --dir: -1 }`. Every directional transform multiplies by it.
`--origin-inline-start` (`left` → `right` in RTL) exists because `transform-origin` has no
logical keyword in CSS.

### Shape & density

`--radius` `--radius-sm` `--radius-lg` `--radius-pill` · `--row-h` ·
`--control-h-sm|md|lg` · `--space-unit|tight|stack|block|section`.

Nested radius: use `rounded-nested`, i.e. `max(3px, calc(var(--radius) - 8px))`. **A child's
corner is concentric with its parent's, never parallel.**

### Legacy aliases

`--background --foreground --card --card-foreground --popover --muted --muted-foreground
--secondary --input --destructive --destructive-foreground` are kept as `var()` aliases onto
the new names so nothing breaks mid-migration. **Do not add new uses.** `bg-card` is
`bg-surface-2`; `text-muted-foreground` is `text-ink-3`.

---

## 4. Portal posture

`<html data-portal="customer|seller|admin">` selects it, and each app's `globals.css` also
applies the density half unconditionally so a portal is correct before its layout gains the
attribute. **Not three looks — one system at three intensities.**

| | customer | seller | admin |
|---|---|---|---|
| `--field-intensity` | 1.0 | 0.30 | 0.15 |
| `--radius` | 14px | 10px | 8px |
| `--row-h` | 44px | 36px | 32px |
| `--space-section` | 72px | 40px | 32px |
| `--motion-scale` | 1.0 | 0.8 | 0.7 |
| rungs in play | 0–5 | 0,1,2,4,5 | 0,1,2,4,5 |
| `--ease-spring` | 2 uses only | **banned** | **banned** |
| glass per view | ≤3 | ≤2 | ≤2 |
| primary fills per view | 1 hero + 1 CTA | 1 CTA | 0 (colour is state only) |
| staged reveals | on | tables off | **off entirely** |
| pointer specular | product + category cards | no | hero KPI only |

**Customer — desirable.** Desire has to come from light, space and material here precisely
*because* the truth law forbids the usual levers: there are no ratings, no HOT/NEW badges,
no discount theatre. A storefront that cannot lie has to be beautiful instead, and
depth-and-light is the one currency that costs no truth.

**Seller — efficient over long sessions.** Field nearly off, motion 20% faster, tabular
figures on every currency column. Every kinetic joule goes into confirmation. **Nothing
pulses.**

**Admin — authoritative and dense.** Rung-2 panels are near-flat. Tables sit in rung-1
wells with a sticky rung-4 head. Reveals are off — a console must be fully readable at t=0.

---

## 5. Budgets

Three scarce resources. Exceed any and the system reads as decoration.

| Resource | Budget | Permitted |
|---|---|---|
| `backdrop-filter` | **≤3 per viewport customer, ≤2 seller/admin** | Rungs 4–5 only: sticky header, sticky toolbar, sticky `<thead>`, dropdown, drawer, modal, toast, scrim. Never nested. Never on a container taller than the viewport. **Body text never sits on the blur** — put it on an opaque `--surface-2` plate. The `@supports` fallback is in the stylesheet and makes the surface *opaque*, which improves contrast. |
| `--brass` | **≤2% of viewport pixels** | Exactly three uses: the active-indicator rule, tier marks, verification marks. Never a fill, never a gradient, never a button, never an icon tile. Reachable only through `<NavItem>` and `<TierMark>`. |
| `--primary` fill | **1 per view + the page's single CTA** | Commit actions and focus. Links and eyebrows use `--primary-ink`. |
| gradients | **exactly one** | `<AmbientField>`. Nowhere else. |

---

## 6. Primitives

All are Server Components unless marked **client**. Client primitives import zod from
`@avenick/types/schemas` and rate limits from `@avenick/auth/rate-limit`, never the barrels.

### Foundation

**`<Surface>`** — everything with a background composes it.
`rung?: 0–5 = 2` · `interactive?` · `lift?` · `glass?` · `tone?: default|success|warning|danger|accent` ·
`as?` · `inset?: number` · `specular?` · `focusLift?` · `bare?`
Emits `data-rung`, `data-interactive`, `data-glass`, `data-tone`, and the `::after` shadow
cross-fade. **Throws in development if `glass` is passed with `rung < 4`.**

**`<FieldWell>`** — rung-1 recessed surface, re-declares `--ring-offset-surface`. `padded?`.
Makes *"recessed = context or input"* a component rather than a convention.

**`<AmbientField>`** — mount **once** per root layout. Zero JS. Replaces the two 384px
`blur-[120px]` storefront orbs and the admin `blur-[100px]` one.

**`<Divider>`** — `tone?: hairline|border|strong|brass` · `orientation?` · `drawn?` · `on?`.
`drawn` is the brass signature that scales itself in from the inline start.

**`<SpecularSurface>`** — **client**. Feeds `--mx/--my` to a `<Surface specular>`. Throttled
to one write per frame; adds `will-change` on enter and removes it on leave; **early-returns
before attaching** on coarse pointer and reduced motion. Product cards, category tiles, the
one admin hero KPI. **Never a table row.**

### Type & truth

**`<Eyebrow>`** — `tone?: muted|accent|brass|primary` · `as?`. Every
`uppercase tracking-widest` string routes through here, which repairs the Arabic damage in
one place.

**`<Num>`** — `value` · `rank?: inline|section|hero` · `currency?` · `unit?`. Tabular
figures at the rank's size and weight, unit at 0.5em in `--ink-3`. Structurally guarantees
the digits are never the animated element.

**`<Dateline>`** — `basis?` · `window?` · `asOf?` · children. The provenance voice. Under
`[dir="rtl"]` it is upright Plex Arabic, **never an obliqued serif**.

**`<PageHeader>`** / **`<SectionHeader>`** — eyebrow + title at h1/h3 rank + optional
Dateline + actions + underrule. Enforces the scale so
`text-2xl font-extrabold tracking-tighter` cannot be hand-written again.

### Data display

**`<Stat>`** — `label` · `value` · `rank?` · `currency?` · `unit?` ·
`delta?: {value, direction, tone}` · `deltaWithheld?` · `chip?: neutral|success|warning|danger` ·
`icon?` · `dateline?` · `note?` · `href?` · `linkComponent?`.
`chip` has exactly four states — that is what lets the ten-hue icon rainbow die.
`deltaWithheld` renders "No prior-month figure" as a Dateline rather than an empty corner.

**`<CellGrid>`** — `cols?: {base,sm,lg}` · `density?`. One outer border and 1px hairline
rules (a `gap-px` filled by `--hairline`, each cell painting its own surface over it —
direction-neutral by construction). No per-cell edge. Drops the seller dashboard's object count from ~20 to
~5.

**`<StatGrid>`** — `leadCount?: 1|2` plus CellGrid's props. Enforces rank distribution: a
flat ten-tile grid at uniform weight is structurally impossible.

**`<Meter>` / `<Bar>`** — `value` · `max?` · `tone?` · `size?` · `label?` · `index?`.
Recessed track, raised fill, **one element**, `scaleX` from the inline start. Replaces the
seller's ten-div meter and the admin's twenty-div Bars.

**`<LedgerTable>`** — `columns` · `rows` · `getRowKey` · **`empty` (required)** · `density?` ·
`stickyHead?` · `title?` · `dateline?` · `toolbar?` · `footer?` · `rowProps?`.
No zebra, no vertical rules, hairline between rows only, 2px underrule under a micro-caps
head, `--row-h` height, numeric columns end-aligned and tabular. The sticky head is a rung-4
glass bar — **the only glass permitted inside a table.**

**`<StatusPill>`** — `tone?: neutral|success|warning|danger|accent|primary` · `dot?`.
Token triples with real dark values. The dot is static: a pulsing dot beside a number read
sixty times a day is fatigue, not urgency.

**`<TierMark>`** — `tier?` · `label?` · `verified?` · `verifiedLabel?`. The **only**
component that may emit brass outside the active-nav rule.

**`<TableShell>` / `<TableHead>`** — kept for existing hand-written tables; now a rung-1
well with the ledger head. Prefer `<LedgerTable>` for new work.

### Layers & chrome

**`<Layer>`** — **client**. `open` · `onOpenChange` · `title` · `description?` ·
`hideTitle?` · `side?: center|start|end|bottom` · `size?` · `footer?` · `closeLabel?`.
Rung 5, `--blur-modal`, focus trap, Esc, scroll lock, Z entry, scrim that blurs and darkens
together. **The customer cart drawer, the seller bulk-edit sheet and the admin approval
modal are all this component** — that is a large part of what makes three portals feel like
one product. `side` is logical.

**`<StickyGlassBar>`** — **client** (sentinel only). `offset?` · `as?`. Crosses rung 0 → 4
via an `IntersectionObserver` on a 1px sentinel, never a scroll listener. **With JS off the
bar is always glass.**

**`<NavItem>`** — `href` · `label` · `icon?` · `active` · `badge?` · `orientation?` ·
`linkComponent?` · `iconOnly?`. The active item sits on rung 3 with a real cast shadow while
every sibling is flat, plus a 2px brass drawn rule at the inline start.

**`<Button>`** — `variant: primary|accent|secondary|ghost|outline|destructive|danger|link` ·
`size: xs|sm|md|lg|icon` · `asChild?` · `loading?`. Heights from `--control-h-*`, two-stop
focus ring, 90ms press translate.

**`<Field>`** — `label` · `htmlFor?` · `hint?` · `error?` · `required?` · `hideLabel?`.
The error line's space is reserved, so a failed validation never shifts the layout.

### Motion & state

**`<Reveal>`** — server-safe. `index?` · `as?`. Emits `data-reveal` and `--reveal-index`.
**`<RevealGroup>`** staggers its own children.

**`<RevealRoot>`** — **client**, mount once per layout. One IntersectionObserver for the
whole page. It hides **only** elements it has confirmed are below the fold, so nothing above
the fold ever flashes and **if it never runs the page is simply fully visible**.

**`useCommitState()` / `<CommitRow>`** — **client**. Returns
`{ state, begin, commit, fail, reset, onTransitionEnd }` and drives the border-inline-start,
the wipe, the badge cross-fade and the exit. **Presentation only — it does not wrap,
replace, delay or gate the server action, the permission check or the validation.**

### Loading & empty

**`<Skeleton>`** · **`<SkeletonStat>`** · **`<SkeletonCellGrid>`** · **`<SkeletonCard>`** ·
**`<SkeletonStats>`** · **`<SkeletonLedger>`** · **`<SkeletonTable>`** · **`<SkeletonList>`**.
Each occupies the same box as the thing it replaces. Use `SkeletonCellGrid` (one panel) when
the loaded state is a `CellGrid` — N floating cards followed by one panel makes the page
visibly reassemble itself.

**`<EmptyState>`** — `eyebrow?` · `headline` · `body?` · `action?` · `icon?`
(`title`/`description` still accepted). An editorial blank: a rule, an eyebrow naming the
state, the precise sentence in the provenance voice, one action. **Every list, table and
grid in all three portals must pass one.** Say precisely *what* is empty — "No orders yet"
is a fact, "Nothing to see here" is filler.

---

## 7. RTL — construction rules, not review items

1. **Every shadow has zero x-offset.** Everywhere, no exceptions.
2. **`--dir`.** Every directional transform multiplies by it:
   `translateX(calc(12px * var(--dir)))`. No component writes a mirrored rule of its own.
3. **All negative tracking → 0 in RTL** (token-level; letter-spacing breaks the joins
   between Arabic letterforms).
4. **All line-heights × ~1.10 in RTL** — Naskh needs vertical room for diacritics.
5. **Body steps up to 16px in RTL** — Plex Arabic runs optically smaller than Inter.
6. **The eyebrow drops `uppercase` and tracking in RTL** — Arabic has no case, so uppercase
   is a no-op that signals nobody looked, and 0.06em tracking pulls words apart. Handled by
   `.u-micro`, i.e. by `<Eyebrow>`.
7. **Logical properties only**, everywhere: `ms-/me-/ps-/pe-`, `border-s/border-e`,
   `rounded-s/rounded-e`, `text-start/text-end`, `start-*/end-*`, `inset-x`,
   `transform-origin: var(--origin-inline-start)`.
8. **Direction-implying icons flip**: `rtl:rotate-180` on chevrons and arrows.
9. **Prices stay in Western digits in both locales** — GCC commerce convention, and a
   deliberate decision. Do not "fix" it.
10. **The Dateline is upright Plex Arabic in RTL**, never an obliqued serif.

---

## 8. Motion vocabulary — exact values

| Gesture | Spec |
|---|---|
| **Press** | `translateY(var(--press-y))` at `--t-press`, `--ease-standard`. Never `scale` — scaling a button scales its label and blurs the text. |
| **Hover lift** | `translateY(var(--lift-y))` = 2px, plus the rung 2→3 pseudo cross-fade, at `--t-hover`. |
| **Image on card hover** | `scale(1.03)` over 320ms `--ease-out`. Not `scale-110`: that is an expensive repaint across a grid *and* it crops the product. |
| **Focus travel** | Two-stop ring over `--t-press`, plus a one-rung promotion. |
| **The drawn rule** | 2px brass, `scaleX(0→1)` from `--origin-inline-start`, 160ms `--ease-in-out`. Active nav, selected tab, link underline, section marker. |
| **Meter fill** | One element, `scaleX()`, 420ms `--ease-out`, 60ms stagger down a funnel. The number beside it does not move. |
| **Row commit** | 3px inline-start rule (always present, only its colour changes, so nothing reflows) + a soft wipe `scaleX(0→1)` over 260ms + a badge cross-fade. Total ≤380ms. |
| **Queue drain** | `opacity 1→0` + `translateX(calc(12px * var(--dir)))` over 180ms `--ease-exit`, unmount on `transitionend`. No height animation. |
| **Layer entry** | From `translateZ(-40px) scale(.972) translateY(8px)` opacity 0 → flat, `--t-layer` `--ease-out`, inside `perspective: 1000px`. Scrim blurs and darkens simultaneously. |
| **Glass crossover** | Rung 0 → 4 over `--t-panel`, driven by an IntersectionObserver on a 1px sentinel. |
| **Staged reveal** | `opacity 0→1` + `translateY(12px)→0` over `--t-panel`, `--stagger` 40ms, **capped at six children**. Storefront only; tables never; admin off entirely. |
| **Pointer specular** | `--mx/--my` once per rAF; a `::before` radial-gradient at ≤9% rim alpha, opacity only. No blend modes. |
| **Skeleton shimmer** | The **only** infinite animation in the product. Stops under reduce. |

### Reduced motion

The complete contract is in the stylesheet. Durations go to **1ms, not 0**, because
`transitionend` must still fire or a queue-drain unmount hangs forever. `--lift-y`,
`--press-y`, `--stagger` and `--blur-scrim` are zeroed at the source, and
`[data-lift]/[data-reveal]/[data-layer]` get `transform: none`. **State changes still
happen — they just arrive instantly.** Every JS-driven effect additionally *early-returns
before attaching*, so the listener is never registered.

---

## 9. Banned outright

**Gestures:** 3D tilt on any card, in any portal. `mix-blend-mode` anywhere. Scroll-linked
transforms. Parallax. Rotating cubes, floating orbs, 3D charts, extruded bars, perspective
on tables. Count-up or ticking numbers — every intermediate frame of a count-up displays a
financial figure that is false.

**Marks:** `.text-gradient` (now neutralised to plain ink; delete the last call sites). The
indigo→violet gradient pairing. Neon glow — `--glow-*` is not defined. Ten raw hues of icon
chip: ten colours carrying zero information is the loudest amateur signal in the product.

**Code:** `transition-all`. Hand-written `shadow-[...]` or `box-shadow` outside
`packages/ui`. `font-bold` / `font-extrabold` (they are remapped to 600 — stop writing
them). `font-mono` on money. Any physical directional property: `ml- mr- pl- pr- left-
right- text-left text-right`. Raw hex or `rgb()` in a component. `animate-pulse` on anything
that is not a loading indicator. Nested `backdrop-filter`. A local
`<div className="rounded-2xl border border-border bg-card shadow-sm">`.

**Structural:** a fourth token file. A per-app token block. A page becoming
`"use client"` to get an animation.

---

## 10. The eleven ways this ships badly

1. **Blur sprayed onto rung 2.** The page goes milky and mid-range Android stutters. This is
   the number one failure mode.
2. **White borders on all four sides.** If light comes from one place, the bottom edge
   cannot also be lit.
3. **Visible ambient orbs.** The field must have no discernible edge and must carry noise.
4. **The rainbow survives.** If ten hues of icon chip remain, none of the depth work
   registers.
5. **Body text on a blurred surface.** It will fail 4.5:1 at *some* scroll position and you
   cannot test every one. Opaque plate, always.
6. **Copying the light shadow stack into dark.** A dark rung-2 card with a light shadow and
   no rim is invisible.
7. **Depth without rank.** Shadows plus a uniform grid plus bold-everything is the same
   product with more blur.
8. **Radius chaos.** Child radius = parent radius − inset. Use `rounded-nested`.
9. **Ten shadow variations.** Five rungs, exactly.
10. **Theme-switch jank.** Use the `.theme-transition` class, which `<ThemeToggle>` adds for
    200ms. Never a permanent wildcard transition.
11. **LTR-only kinetics.** A wipe that always travels left→right, a chevron that does not
    flip.

---

## 11. How to build a surface with this — worked example

A seller "Open RFQs" panel: a heading with provenance, a hairline-divided stat band, a table
with a real empty state, and a row that confirms when it is acted on.

```tsx
import {
  PageHeader, CellGrid, Stat, LedgerTable, EmptyState, Button,
  StatusPill, Num, Dateline, Surface, Meter,
} from "@avenick/ui";
import Link from "next/link";

export default async function RfqPage() {
  // Data fetching, permission checks and validation are untouched by the design
  // system. Meridian is presentation.
  const { rfqs, stats, windowDays } = await getSellerRfqs();

  return (
    <div className="space-y-block">
      <PageHeader
        eyebrow="Sourcing"
        title="Open RFQs"
        // LAW E. This is not fine print — it is what makes the number credible.
        dateline={`Requests assigned to this supplier · last ${windowDays} days`}
        actions={<Button variant="primary" size="sm">New quote</Button>}
      />

      {/* ONE panel with hairline dividers, not four floating cards. StatGrid
          would promote the first tile to section rank if one of these mattered
          more than the others. */}
      <CellGrid cols={{ base: 2, lg: 4 }}>
        <Stat label="Awaiting quote" value={stats.awaiting} rank="section" chip="warning" />
        <Stat label="Quoted" value={stats.quoted} />
        <Stat label="Won" value={stats.won} chip="success" />
        <Stat
          label="Median response"
          value={stats.medianHours ?? "—"}
          unit={stats.medianHours ? "h" : undefined}
          // No prior window to compare against, so we say that rather than
          // leaving a corner empty or inventing a delta.
          deltaWithheld={stats.priorMedianHours ? undefined : "No prior period recorded"}
        />
      </CellGrid>

      <LedgerTable
        rows={rfqs}
        getRowKey={(r) => r.id}
        stickyHead
        dateline="Buyer-submitted requests, as recorded · no conversion applied"
        columns={[
          { key: "ref", label: "Reference", render: (r) => <span className="u-mono">{r.ref}</span> },
          { key: "buyer", label: "Buyer" },
          { key: "qty", label: "Qty", numeric: true },
          {
            key: "value", label: "Est. value", numeric: true,
            // Each figure in its own currency, because that is how it is stored.
            render: (r) => <Num value={r.value} currency={r.currency} />,
          },
          { key: "status", label: "Status", render: (r) => <StatusPill tone={r.tone}>{r.label}</StatusPill> },
        ]}
        empty={
          <EmptyState
            eyebrow="Nothing recorded"
            headline="No open requests for quotation."
            body="Buyers who send you an RFQ will appear here."
            action={<Button variant="secondary" size="sm" asChild><Link href="/catalog">Review your catalogue</Link></Button>}
          />
        }
      />
    </div>
  );
}
```

Things to notice:

- **No `<div className="rounded-2xl border …">` anywhere.** Every surface is a primitive.
- **No `font-bold`, no `text-2xl`, no hardcoded colour.** Rank comes from `Stat`'s `rank`
  and from `PageHeader`.
- **`empty` is required**, so this table cannot ship without an honest empty state.
- **Two datelines**, because two different things have a basis and a window.
- Nothing here is `"use client"`. If a row needs the commit choreography, extract a small
  client component around `<CommitRow>` — do not promote the page.

### Deciding a rung, in one question

```
Is it clickable?          → 3 (and no more than one per viewport)
Is it an input, a table head, or a context band?  → 1
Does it float over the page (sticky bar, dropdown, drawer, modal)? → 4 or 5, and only these may be glass
Otherwise                 → 2 for an object, 0 for content inside one
```

---

## 12. Migration status

Already done for you, with no page edits required:

- `rounded-xl` / `rounded-2xl` / `rounded-3xl` now resolve to the portal's `--radius`.
- `shadow-card` / `shadow-elevated` / `shadow-glow` / `shadow-glow-sm` / `shadow-xs` now
  resolve to elevation rungs. The glow is no longer a glow.
- `font-bold` / `font-extrabold` / `font-black` all resolve to **600**.
- `.glass`, `.text-gradient`, `.bg-grid`, `.mask-fade-b`, `.scrollbar-hide`,
  `.scrollbar-thin`, `.skeleton` still exist and are token-driven. **All deprecated** —
  delete each call site as you migrate its page.
- The `float 6s infinite` keyframe is deleted. `animate-float` no longer resolves.
- The wildcard theme transition is gone.

Still owed by surface teams: `data-portal` on each root layout's `<html>` (until then the
portal posture comes from the app stylesheet, which covers density and motion but not the
type steps), `<AmbientField>` and `<RevealRoot>` mounted once per root layout, and the
removal of the last `.glass` / `.text-gradient` / raw-hue call sites.
