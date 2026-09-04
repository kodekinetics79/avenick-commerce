/**
 * Every migration this build expects the database to have applied.
 *
 * Generated from prisma/migrations and COMMITTED, rather than read from disk at
 * runtime: a Next.js server bundle does not ship the migrations directory, so a
 * runtime read would find nothing and report "no drift" on every deployment —
 * the check would be permanently, silently green.
 *
 * migration-manifest.regression.test.ts asserts this list still equals the
 * directory, so adding a migration without regenerating fails CI instead of
 * quietly shrinking what the drift probe is able to notice.
 *
 * Regenerate with: pnpm --filter @avenick/database db:manifest
 */
export const EXPECTED_MIGRATIONS: readonly string[] = [
  "20260530234542_init_avenick_schema",
  "20260601010030_add_requisition_lists",
  "20260601012214_add_product_reviews",
  "20260601013412_add_support_tickets",
  "20260601015750_fk_index_coverage",
  "20260601020742_add_shipments_returns",
  "20260601021629_add_perf_tracking",
  "20260601140830_add_saved_views",
  "20260703004406_add_order_idempotency_key",
  "20260730234500_enforce_catalog_display_price_uniqueness",
  "20260813014500_pilot_commerce_control_plane",
  "20260813020500_governed_purchase_order_lines",
  "20260813050000_fenced_integration_leases",
  "20260813143000_po_approval_and_order_fingerprints",
  "20260813170000_integration_runtime_integrity",
  "20260813183000_minimize_order_fingerprint",
  "20260813193000_refund_clawback_and_po_placing",
  "20260813210000_variant_refund_commercial_truth",
  "20260813213000_rfq_quote_version",
  "20260813223000_company_integration_routing",
  "20260814160000_real_catalog_discovery_search",
  "20260903200000_shipping_zones",
];
