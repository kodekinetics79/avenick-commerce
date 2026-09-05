/**
 * The discovery panel's public surface.
 *
 * `DiscoveryPanel` is a client component; a server component may RENDER it and
 * pass it rows, which is what <MainLayout> does. It must not import the values
 * below and call them — see packages/ui/src/button-variants.ts for what Next
 * does to a value exported from a "use client" module when the server graph
 * imports it.
 */
export { DiscoveryPanel, type DiscoveryPanelProps } from "./discovery-panel";
export { recordProductView, useDiscoverySignals } from "./use-discovery";
export type { DiscoveryHistory, DiscoveryPlan, TrendingProduct, ViewedProduct } from "./interest-signals";
export { buildDiscoveryPlan } from "./interest-signals";
