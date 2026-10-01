# Avenick product design context

The canonical visual system is [packages/ui/DESIGN_SYSTEM.md](packages/ui/DESIGN_SYSTEM.md):
SIJILL, “the GCC trade register turned into a commerce engine.” It owns visual
laws, tokens, typography, depth, motion, and shared primitives for customer,
seller, and admin applications.

This file is the repository entry point, not a second token source. Runtime
values flow from `packages/ui/src/globals.css` through
`packages/config/tailwind.config.base.js` into `@avenick/ui`. Durable changes
must update the canonical document, runtime owner, shared primitive, and tests
in one changeset.

## Product registers

- **Customer:** persuasive, search-first industrial commerce. Product imagery,
  commercial facts, verified evidence, and a clear buy-or-quote decision carry
  the experience.
- **Seller:** a dense revenue cockpit. Prioritize readiness, demand, conversion,
  stock risk, RFQ response, fulfilment, payouts, and one truthful next action.
- **Admin:** a market command center. Prioritize conversion leakage, supplier
  activation, settlement/risk exceptions, campaign return, and supply gaps.

## Identity palette across portals

- Aubergine carries Avenick identity, navigation, and signed-in access across
  customer, seller, and admin surfaces.
- Copper is reserved for commercial conversion actions such as RFQ creation.
- Green remains semantic success; verdigris remains trade/verification. Neither
  is used as a generic sign-in or brand action.

## Non-negotiables

- Never invent ratings, scarcity, discounts, response times, verification,
  customer counts, or commercial outcomes.
- Use depth semantically: raised is actionable, recessed is context/input, flat
  is content. Keep one dominant item per viewport.
- Keep Arabic and English at feature parity, with logical-direction layout and
  locale-owned copy, dates, numbers, and accessible names.
- Reserve 3D for actual product comprehension, fitment, or spatial exploration.
  Operational tables and forms do not receive decorative spectacle.
- Extend `@avenick/ui`; do not build screen-local versions of shared controls.

`DESIGN_SYSTEM_NOTES.md` and `UI_UX_REVAMP_NOTES.md` are historical records and
must not be used as current visual guidance.
