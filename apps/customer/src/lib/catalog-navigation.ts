type CatalogContext = {
  b2b?: string;
  currency?: string;
};

export function emptyCategoryRecoveryHref(context: CatalogContext) {
  const query = new URLSearchParams();
  if (context.b2b === "true") query.set("b2b", "true");
  if (context.currency) query.set("currency", context.currency);
  const suffix = query.toString();
  return suffix ? `/products?${suffix}` : "/products";
}
