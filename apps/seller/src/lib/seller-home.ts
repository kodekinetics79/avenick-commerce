const LANDING_ROUTES: ReadonlyArray<[string, string]> = [
  ["dashboard.view", "/dashboard"],
  ["orders.view", "/orders"],
  ["orders.fulfill", "/orders"],
  ["catalog.view", "/products"],
  ["catalog.manage", "/products"],
  ["inventory.view", "/inventory"],
  ["inventory.manage", "/inventory"],
  ["rfqs.view", "/messages"],
  ["quotes.submit", "/quotes/submit"],
  ["finance.view", "/payouts"],
  ["documents.view", "/documents"],
  ["documents.manage", "/documents"],
  ["support.view", "/support/tickets"],
];

export function sellerLandingRoute(permissions: readonly string[]) {
  if (permissions.includes("*")) return "/dashboard";
  return LANDING_ROUTES.find(([permission]) => permissions.includes(permission))?.[1] ?? "/login?error=permissions";
}
