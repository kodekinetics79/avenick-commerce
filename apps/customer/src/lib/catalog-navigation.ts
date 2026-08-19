type CatalogContext = {
  b2b?: string;
  currency?: string;
};

/**
 * Link to the unfiltered catalog, preserving governed storefront context.
 *
 * This is offered as a visible link from an empty-category state — never as an
 * automatic redirect. Silently rerouting a visitor from an empty category to
 * the full catalog hides the fact that the category is empty and answers a
 * question they did not ask.
 */
export function browseAllHref(context: CatalogContext) {
  const query = new URLSearchParams();
  if (context.b2b === "true") query.set("b2b", "true");
  if (context.currency) query.set("currency", context.currency);
  const suffix = query.toString();
  return suffix ? `/products?${suffix}` : "/products";
}
