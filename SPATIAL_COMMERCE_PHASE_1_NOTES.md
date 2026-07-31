# Spatial Commerce Phase 1 Notes

## Workstream

- Identifier: `WS-SPATIAL-COMMERCE`
- Feature: `F01-SPATIAL-SKU-SHELL`
- Branch: `feature/spatial-commerce-shell`
- Route: `/b2b/spatial-commerce`
- Production enable flag: `SPATIAL_COMMERCE_3D_ENABLED=true`
- Development fixture flag: `SPATIAL_COMMERCE_FIXTURES=true`

The route is authenticated and deny-by-default. Fixture rows are available only when both flags are true and `NODE_ENV` is not `production`. Enabling the route in production never enables fixture catalog, price, availability, or inventory data.

Feature status: accepted as a gated Phase 1 shell with the platform-wide dependency and future-production-data limitations below. It is not approval for a public production rollout or for later spatial cart/model phases.

## Architecture decisions

- React Three Fiber is the Phase 1 renderer because it provides typed React lifecycle integration and stable part-level interaction without depending on a remote scene. Spline is intentionally not installed or loaded.
- Commerce state and bindings contain only stable string node IDs. They do not import Three.js, meshes, cameras, or renderer objects.
- The standard semantic SKU table is the authoritative non-3D workflow. Canvas interaction is progressive enhancement.
- Selection is reducer-owned. `pulseRevision` increments on every selection, including reselection, so a transient pulse is independent from the persistent selected state.
- The scene is dynamically imported. Mobile does not request it until the viewer is opened; desktop requests it after viewport detection.
- The mock assembly uses local procedural geometry. It adds no model URL, texture domain, decoder, worker, analytics provider, API, cart mutation, or CSP exception.
- Scene animation is bounded by visibility, intersection, reduced-motion, coarse-pointer, and Save-Data policies. DPR is capped at 1.5 and no shadows or post-processing are used.
- Save-Data prevents the lazy WebGL renderer from mounting. Renderer failure, context loss, and no-WebGL states retain semantic part controls and an explicit retry path.
- Live database user account class, membership role/activity, and company status are checked on every route request. Company membership is authoritative for current B2B role changes; consumer, seller, and platform-admin account classes remain denied.
- The production shell input requires complete English/Arabic product content. Synthetic development records remain a separately disclosed, non-production input type.
- Production responses add route-scoped CSP, anti-framing, no-sniff, permissions, referrer, and private/no-store headers. The authenticated preview is `noindex, nofollow`.

## Mapping contract

`SkuSpatialBinding` supports one SKU to one or many stable target IDs and safe missing mappings. Reverse lookup allows an interactive scene part to select and focus the corresponding table row. Model-versioned manifests and assembly-node-to-multiple-SKU relationships remain Phase 2/5 concerns.

## Future integration boundaries

- Cart: connect selected authorized SKU IDs to the existing server-authoritative cart mutation with idempotency, tenant validation, pricing/inventory reconciliation, and rollback. No fake mutation exists in F01.
- Commands: connect an allowlisted command registry to the renderer-independent scene controller. Never evaluate arbitrary input or URLs.
- Production assets: self-host optimized GLB/GLTF; use stable exported node IDs, a versioned mapping manifest, Meshopt/Draco where measured, KTX2 textures, LODs, immutable CDN caching, and explicit asset-domain CSP review.

## Validation ledger

- `pnpm --filter @avenick/customer test`: 16 files and 67 tests passed.
- `pnpm --filter @avenick/customer typecheck`: passed.
- `pnpm --filter @avenick/customer lint`: passed without warnings.
- `SPATIAL_COMMERCE_3D_ENABLED=true SPATIAL_COMMERCE_FIXTURES=true pnpm --filter @avenick/customer build`: passed in production mode. The build logged the repository-pre-existing caught missing-`DATABASE_URL` brand-export error plus existing bcrypt/OTel/jose Edge-runtime warnings.
- Production bundle scan for `FIX-MECH`, fixture IDs, descriptions, and prices: passed; no fixture records exist in `.next/static` or `.next/server`, even when both flags are set during the production build.
- Production routes manifest contains the spatial CSP, `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `nosniff`, restricted permissions, and `Cache-Control: private, no-store`.
- Production build: shared first-load JavaScript 87.5 kB; `/products` 198 kB; `/products/[slug]` 203 kB; spatial shell 197 kB (6.8 kB compressed route code) before optional viewer chunks.
- Lazy viewer chunks: 130,007 + 378,783 + 339,599 + 4,481 raw bytes (approximately 223 kB gzip in total). They are dynamically imported and absent from unrelated route entry manifests.
- `pnpm --filter @avenick/customer test:e2e:spatial`: 16 browser tests passed across installed Chrome desktop, Chrome Pixel 7 touch/mobile emulation, Firefox, and WebKit.
- Browser coverage passed for 60/40 layout, table-to-scene synchronization, reselection pulse, keyboard selection, reduced motion, Arabic/RTL, mobile viewer-on-demand, no-WebGL fallback, and actionable console errors.
- Axe WCAG A/AA scans passed on desktop English, Arabic, mobile, and no-WebGL states in the applicable browser projects. Contrast failures found during review were corrected before the final run.
- Login hardening tests reject absolute, protocol-relative, backslash, encoded-backslash, and control-character callback destinations. Seed credentials are not rendered and login errors are announced.
- `git diff --check`: passed.
- Production runtime smoke test with the flag off: canonical `GET /b2b/spatial-commerce` returned direct `404 Not Found`; the trailing-slash form normalized with `308` to that canonical route; control request `GET /b2b` followed the existing `307` authentication redirect. The local control request also logged the expected missing `AUTH_SECRET` configuration error.
- `pnpm audit --prod --audit-level high`: failed on 37 repository-wide advisories (3 critical, 14 high, 18 moderate, 2 low), including existing Next.js/Auth.js/PostCSS dependency paths. Dependency remediation is a platform-level release gate; the command did not identify a feature-specific runtime data path.

## Independent consultant disposition

- B2B UX, Arabic/RTL, and accessibility: Phase 1 pass after mobile semantics, terminology, focus, contrast, and browser/axe remediation.
- React/WebGL architecture and performance: pass after Save-Data no-load, bounded idle motion, deterministic retry, context-loss fallback, loading reset, and lifecycle tests.
- Application security and compliance: F01 controls pass with documented hardening work; platform production release remains blocked by the shared Next.js/Auth.js advisory set.

## Phase boundary

F01 implements the shell, procedural scene, dense table, bidirectional selection synchronization, accessibility fallbacks, flags, headers, and automated browser certification. It does not claim completion of production asset ingestion, real tenant-authorized catalog integration, cart/quote mutations, command menus, tenant rollout entitlements, mobile-hardware soak testing, or the coordinated Next.js/Auth.js platform upgrade. CSP currently retains `script-src 'unsafe-inline'` for Next.js compatibility; nonce-based hardening is required before later sensitive spatial mutations or command features.
