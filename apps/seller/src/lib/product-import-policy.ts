export type ProductImportField = {
  nameEn?: string;
  nameAr?: string;
  status?: string;
  price?: string;
  stock?: string;
};

/**
 * CSV authorization is field-sensitive. Catalog staff may edit listing fields,
 * but commercial price and physical stock are separate capabilities.
 */
export function requiredProductImportPermissions(rows: readonly ProductImportField[]) {
  const required = new Set<string>(["catalog.manage"]);
  if (rows.some((row) => Boolean(row.price?.trim()))) required.add("pricing.manage");
  if (rows.some((row) => Boolean(row.stock?.trim()))) required.add("inventory.manage");
  return [...required];
}

export function assertProductImportPermissions(
  granted: readonly string[],
  rows: readonly ProductImportField[],
) {
  if (granted.includes("*")) return;
  const missing = requiredProductImportPermissions(rows).filter((permission) => !granted.includes(permission));
  if (missing.length > 0) throw new Error(`Seller permission required: ${missing.join(" and ")}`);
}

export function stockQuantityCoversReservations(quantity: number, reservedQuantity: number) {
  return Number.isInteger(quantity) && quantity >= 0 && quantity >= reservedQuantity;
}
