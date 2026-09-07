/**
 * @avenick/contracts — the /api/v1 mobile surface, as zod schemas for BOTH
 * requests and responses, plus the OpenAPI 3.1 document generated from them.
 *
 * WHY THIS PACKAGE EXISTS
 *
 * The Flutter app's Dart models are generated from `openapi.json`. If the
 * document is written by hand it drifts from the server within a release; if
 * it is generated from the same schemas the routes parse with, it cannot.
 * `scripts/verify-openapi-contract.mjs` is the gate that keeps the committed
 * document equal to what the schemas produce.
 *
 * WHAT IS SAFE TO IMPORT WHERE
 *
 * Everything here. This package depends on `zod` and nothing else at runtime:
 * no Prisma, no `@avenick/database`, no `next`, not even an `import type` edge
 * to any of them. That is deliberate — `@avenick/types`' barrel drags the
 * Prisma client and `@vercel/otel` into whatever bundle imports it, which is
 * why consumers there have to reach for the `/schemas` subpath. There is no
 * such trap here, and the `no-forbidden-imports` test keeps it that way.
 *
 * The OpenAPI generator (`@asteasolutions/zod-to-openapi`) is a DEV dependency
 * used only by `src/openapi/*`, which nothing in this barrel imports, so it
 * never reaches an application bundle.
 */

export * from "./enums";
export * from "./primitives";
export * from "./envelope";
export * from "./auth";
export * from "./cart";
export * from "./checkout";
export * from "./catalogue";
export * from "./orders";
export * from "./me";
export * from "./addresses";
export * from "./devices";
