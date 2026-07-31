# Spatial Commerce Phase 1 Notes

## Workstream

- Identifier: `WS-SPATIAL-COMMERCE`
- Feature: `F01-SPATIAL-SKU-SHELL`
- Branch: `feature/spatial-commerce-shell`
- Route: `/b2b/spatial-commerce`
- Production enable flag: `SPATIAL_COMMERCE_3D_ENABLED=true`
- Development fixture flag: `SPATIAL_COMMERCE_FIXTURES=true`

The route is authenticated and deny-by-default. Fixture rows are available only when both flags are true and `NODE_ENV` is not `production`. Enabling the route in production never enables fixture catalog, price, availability, or inventory data.

## Architecture decisions

- React Three Fiber is the Phase 1 renderer because it provides typed React lifecycle integration and stable part-level interaction without depending on a remote scene. Spline is intentionally not installed or loaded.
- Commerce state and bindings contain only stable string node IDs. They do not import Three.js, meshes, cameras, or renderer objects.
- The standard semantic SKU table is the authoritative non-3D workflow. Canvas interaction is progressive enhancement.
- Selection is reducer-owned. `pulseRevision` increments on every selection, including reselection, so a transient pulse is independent from the persistent selected state.
- The scene is dynamically imported. Mobile does not request it until the viewer is opened; desktop requests it after viewport detection.
- The mock assembly uses local procedural geometry. It adds no model URL, texture domain, decoder, worker, analytics provider, API, cart mutation, or CSP exception.
- Scene animation is bounded by visibility, intersection, reduced-motion, coarse-pointer, and Save-Data policies. DPR is capped at 1.5 and no shadows or post-processing are used.

## Mapping contract

`SkuSpatialBinding` supports one SKU to one or many stable target IDs and safe missing mappings. Reverse lookup allows an interactive scene part to select and focus the corresponding table row. Model-versioned manifests and assembly-node-to-multiple-SKU relationships remain Phase 2/5 concerns.

## Future integration boundaries

- Cart: connect selected authorized SKU IDs to the existing server-authoritative cart mutation with idempotency, tenant validation, pricing/inventory reconciliation, and rollback. No fake mutation exists in F01.
- Commands: connect an allowlisted command registry to the renderer-independent scene controller. Never evaluate arbitrary input or URLs.
- Production assets: self-host optimized GLB/GLTF; use stable exported node IDs, a versioned mapping manifest, Meshopt/Draco where measured, KTX2 textures, LODs, immutable CDN caching, and explicit asset-domain CSP review.

## Validation ledger

- `pnpm --filter @avenick/customer test`: 10 files and 35 tests passed.
- `pnpm --filter @avenick/customer typecheck`: passed.
- `pnpm --filter @avenick/customer lint`: passed without warnings.
- `SPATIAL_COMMERCE_3D_ENABLED=false pnpm --filter @avenick/customer build`: passed. The latest build logged the repository-pre-existing, caught missing-`DATABASE_URL` error while exporting `/api/brands`; an earlier baseline build also emitted Edge-runtime compatibility warnings.
- Production build: shared first-load JavaScript 87.5 kB; `/products` 198 kB; `/products/[slug]` 203 kB; spatial shell 196 kB (6.55 kB route code) before the optional viewer chunks.
- Lazy viewer chunks: 130,007 + 378,783 + 339,599 + 4,321 raw bytes (approximately 223 kB gzip in total). They are requested through dynamic imports and are absent from existing route entry manifests.
- `git diff --check`: passed.
- Production runtime smoke test with the flag off: canonical `GET /b2b/spatial-commerce` returned direct `404 Not Found`; the trailing-slash form normalized with `308` to that canonical route; control request `GET /b2b` followed the existing `307` authentication redirect. The local control request also logged the expected missing `AUTH_SECRET` configuration error.
- Browser E2E, screenshots, real WebGL behavior, browser performance, and automated axe output: not verified because the provided in-app browser connection was unavailable. These remain release gates.
- `pnpm audit --prod --audit-level high`: failed on 37 repository-wide advisories (3 critical, 14 high, 18 moderate, 2 low), including existing Next.js/Auth.js/PostCSS dependency paths. Dependency remediation is a platform-level release gate; the command did not identify a feature-specific runtime data path.

## Phase boundary

F01 implements the shell, procedural scene, table, selection synchronization, accessibility fallbacks, flags, and tests. It does not claim completion of production asset ingestion, real authorized catalog integration, cart/quote mutations, command menus, or full cross-browser certification.
