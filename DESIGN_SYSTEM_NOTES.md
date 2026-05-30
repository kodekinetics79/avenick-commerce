# Avenick Commerce — Design System

**Brand:** Avenick Commerce · **Descriptor:** Modern Trade OS
**Tagline:** B2B-first. B2C-ready. Built for modern trade.

Premium, enterprise-grade SaaS visual foundation for a hybrid B2B + B2C GCC marketplace.

---

## 1. Architecture

The design system is token-driven via CSS variables (HSL) + a shared Tailwind base config.
This lets the **enterprise apps** (admin, seller) and the **consumer storefront** (customer)
share one foundation while expressing distinct primary brands.

- `packages/config/tailwind.config.base.js` — shared scales, semantic colors, shadows
- `apps/<app>/src/app/globals.css` — per-app CSS variable theme (`:root`)
- `packages/ui/src/*` — shared primitives consuming the tokens

### Sub-brand theming
| App | `--primary` | Rationale |
|---|---|---|
| admin / seller | **Blue `#2563EB`** (enterprise CTA) | trustworthy back-office |
| customer | **Green `#16A34A`** (storefront) | friendly consumer marketplace |

Because primitives use `bg-primary` (the CSS var) rather than a hardcoded shade, the same
`<Button variant="primary">` renders blue in admin/seller and green in the storefront.

---

## 2. Color System

### Core palette (design direction)
| Token | Hex | Usage |
|---|---|---|
| Navy (enterprise) | `#0F172A` | sidebars, dark chrome, headings |
| Primary CTA blue | `#2563EB` | primary actions (back-office) |
| Storefront green | `#16A34A` | primary actions (customer) |
| Slate / graphite | `#334155` | secondary structure |
| Accent teal/cyan | `#0891B2` | commerce-intelligence accents |
| Success | `#16A34A` | positive states |
| Warning | `#F59E0B` | caution states |
| Danger | `#DC2626` | destructive / errors |
| Background | `#F8FAFC` (slate-50) | app canvas |
| Card | `#FFFFFF` | surfaces |
| Text primary | `#0F172A` | headings/body |
| Text secondary | `#475569` | supporting copy |
| Text muted | `#64748B` | meta / hints |

### CSS variables (per app `:root`)
`--background --foreground --card --popover --primary --primary-foreground`
`--secondary --muted --muted-foreground --accent --accent-foreground`
`--destructive --border --input --ring --radius`

### Named Tailwind colors (base config)
- `primary.50–950` (blue scale), `navy.50–950`, `accent.50–900` (teal)
- `success`, `warning`, `danger` each with `.DEFAULT .fg .soft .border`
  → enables `bg-success`, `text-warning`, `bg-warning-soft`, `border-danger-border`, etc.

---

## 3. Typography
- **Font:** IBM Plex Sans Arabic (Latin + Arabic, RTL-aware), `font-sans`
- Body is `antialiased` + `optimizeLegibility`
- Headings (`h1–h4`) get `tracking-tight` globally
- Scale: page title `text-2xl font-bold`, section `font-semibold`, body `text-sm`, meta `text-xs`
- Color: title `text-foreground`, secondary `text-muted-foreground`

## 4. Spacing & Radius
- Radius token `--radius: 0.75rem` → cards `rounded-2xl`, controls `rounded-xl`, chips `rounded-lg`
- Page padding `px-4 py-8`, card padding `p-4`–`p-6`, section gap `space-y-6`
- Max content width `max-w-7xl mx-auto`

## 5. Elevation (shadows)
- `shadow-xs` — subtle control elevation
- `shadow-card` — default card
- `shadow-elevated` — popovers / hover lift

---

## 6. Button / CTA Hierarchy
`<Button variant size>` — sizes: `xs sm md lg icon`

| Variant | Use | Examples |
|---|---|---|
| `primary` | Main action (themed) | Create RFQ, Add Product, Submit Quote, Convert to Order, Approve Supplier, Create Shipment, Start Campaign |
| `accent` | Intelligence action (teal) | Generate AI Insight |
| `secondary` | Neutral bordered | View Details, Compare, Save Draft |
| `outline` | Low-emphasis | Filter, Export |
| `ghost` | Inline/toolbar | Add Note, icon actions |
| `destructive` | Danger | Reject, Cancel, Remove, Close Dispute |
| `link` | Tertiary inline | View History, Open Timeline |

---

## 7. Component Inventory (`@manzil/ui`)

**Foundation:** Button, Card, Input, Textarea, Select, Checkbox, RadioGroup, Switch, Combobox, Avatar, Dialog
**Data display:** Badge, StatusBadge, MetricCard, DataTable, **TableShell + TableHead**, CurrencyDisplay, HijriDate
**Feedback:** AlertCard, AIInsightCard, EmptyState, Spinner, PageLoader, **Skeleton / SkeletonCard / SkeletonStats / SkeletonTable**
**Layout:** **PageHeader** (title + breadcrumbs + actions + eyebrow), **SectionHeader** (icon + title + count + action), **Timeline**

### New in this module
| Component | Purpose |
|---|---|
| `PageHeader` | Standard page top: breadcrumbs, eyebrow, title, description, actions |
| `SectionHeader` | In-card/section heading with icon, count badge, action |
| `TableShell` / `TableHead` | Uniform table card chrome (toolbar, scroll, footer) |
| `Timeline` | Order/RFQ lifecycle with done/current/future states (token-driven) |
| `Skeleton*` | Shimmer loading states (card, stats grid, table) |

### Conventions
- **Progress/health bars** use **segmented Tailwind divs** (no inline `style={{ width }}`)
- **Status colors**: success=green, warning=amber, danger=red, info=blue, neutral=slate
- All icon-only buttons require `aria-label` / `title`; all non-submit buttons set `type="button"`

---

## 8. App Shell
- **Sidebar** (admin/seller): navy `#0F172A`, grouped nav with uppercase section labels,
  gradient logo mark, active = primary fill + left accent border, collapsible (localStorage),
  "Modern Trade OS" descriptor + tagline footer
- **Topbar**: white, `h-14`, global search, notification bell, user menu, sidebar toggle
- **Customer header**: utility bar + sticky main nav + search + cart/wishlist + role switcher
- **Canvas**: `bg-background` (slate-50); content cards white with `shadow-card`

## 9. Responsiveness
- Sidebar collapses to icon rail (lg) and to off-canvas drawer (mobile)
- Stat grids: `grid-cols-2 lg:grid-cols-4`; tables scroll via `TableShell` (`scrollbar-thin`)
- Headers/actions wrap with `flex-wrap`; nav uses `scrollbar-hide` horizontal scroll on mobile

## 10. Accessibility & RTL
- `[dir="rtl"]` Arabic font swap; logical props (`ms-/me-/start/end`) used throughout
- Focus rings via `--ring`; `aria-label`s on icon controls; AA contrast on text tokens

## 11. Phase 3 notes
- Status-badge color semantics kept consistent via shared `Badge` variants
  (success/info/warning/error/secondary) — module pages map domain statuses onto
  these rather than ad-hoc colors.
- Relaxed two over-strict TS flags (`exactOptionalPropertyTypes`,
  `noUncheckedIndexedAccess`) so component prop spreads compile cleanly; runtime
  behavior unchanged.
