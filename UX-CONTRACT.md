# Avenick UX contract

Status: canonical behavior contract  
Applies to: customer, seller, and admin applications

## Navigation and state

- Navigation uses links; mutations use buttons or forms. Never ship a false
  affordance.
- Search, committed filters, sort, and pagination remain URL-addressable unless
  the state is sensitive. Empty, no-results, unavailable, and error are
  different states with different recovery.
- Authenticated users without a capability receive an explicit access-denied
  path; the UI must not advertise actions their membership cannot perform.

## Commercial actions

- Checkout, quote decisions, approvals, stock, refunds, payouts, and seller
  status changes are server-authoritative and fail visibly. A swallowed error
  may never look like a recorded commercial decision.
- Commit controls disable while pending and preserve their dimensions. Success
  revalidates the owning record/list and uses the shared feedback system.
- Destructive, costly, bulk, privacy-sensitive, and permission-changing actions
  use the app-owned confirmation dialog and name the consequence.
- Display currency with its source amount. Never add different currencies or
  imply conversion without a rate, provider, and timestamp.

## Forms and control ownership

- Product forms declare `noValidate` and use the shared validation/error
  contract: preserve input, identify fields in text, focus the first error, and
  expose `aria-invalid`/`aria-describedby`.
- `@avenick/ui` owns Button, Input, Textarea, Select, Combobox, Dialog, feedback,
  and table primitives. Shared behavior is fixed once in its owner.
- Shared textareas disable browser drag-resizing and reserve useful writing
  space. Long-form workflows may add an authored auto-grow/expand behavior.
- Native selects are intentional for short, stable enumerations where the
  operating-system popup is acceptable (country, origin, channel, and compact
  sort controls). Use the authored Select/Combobox when popup geometry,
  search, rich option content, or consistent collision behavior is required.
- Native date inputs are intentional only where the OS picker is acceptable and
  the stored value remains an explicit ISO date. Otherwise use the maintained
  authored date owner.
- Search fields provide localized clear actions, 300 ms remote debounce,
  stale-request cancellation, and IME-safe Enter handling.

## Lists and tables

- Operational lists are bounded by pagination or a deliberate cursor strategy.
  Sort headers are real buttons with `aria-sort`; selection survives only while
  the selected records remain in the committed dataset.
- Loading reserves final geometry. Empty, partial-error, and stale data states
  keep filters and recovery actions available.
- Financial and audit tables use deterministic ordering and expose the basis,
  period, currency, and exclusions behind every aggregate.
- Product-owned scroll regions inherit the global SIJILL scrollbar theme;
  component classes may change geometry but do not activate the base theme.

## Locale, access, and motion

- English and Arabic ship together. New visible strings and accessible names
  enter both message catalogs in the same change.
- Target WCAG 2.2 AA: semantic controls, visible focus, 44 px coarse-pointer
  targets, sufficient contrast, correct listbox/dialog keyboard behavior, and
  a skip path past large navigation.
- Motion communicates state and hierarchy, respects reduced motion, and never
  delays access. Directional icons mirror in RTL; overhead depth does not.

## Recovery contract

For every mutation define: trigger → pending → success destination/feedback →
failure message/retry. Preserve user input on failure. Conflict or stale-version
responses must ask the user to reload/review; they must not overwrite newer
commercial state.
