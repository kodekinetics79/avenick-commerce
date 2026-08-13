import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const root = resolve(process.cwd());
const schemaPath = resolve(root, "packages/database/prisma/schema.prisma");
const migrationDir = resolve(root, "packages/database/prisma/migrations/20260813020500_governed_purchase_order_lines");
const migrationPath = resolve(migrationDir, "migration.sql");
const MARKER = "// ─── GOVERNED PURCHASE ORDER LINES";

let schema = await readFile(schemaPath, "utf8");
if (schema.includes(MARKER)) {
  console.log("Governed PO-line schema already applied.");
  process.exit(0);
}

function replaceOnce(needle, replacement) {
  const index = schema.indexOf(needle);
  if (index < 0) throw new Error(`Schema anchor not found: ${needle}`);
  if (schema.indexOf(needle, index + needle.length) >= 0) throw new Error(`Schema anchor is not unique: ${needle}`);
  schema = schema.replace(needle, replacement);
}

replaceOnce(
  "  orders  Order[]\n\n  @@index([companyId, status])",
  "  orders  Order[]\n  items   PurchaseOrderItem[]\n\n  @@index([companyId, status])",
);
replaceOnce(
  "  orderItems       OrderItem[]\n  cartItems        CartItem[]",
  "  orderItems       OrderItem[]\n  purchaseOrderItems PurchaseOrderItem[]\n  cartItems        CartItem[]",
);
replaceOnce(
  "  inventory InventoryStock[]\n\n  @@index([productId])",
  "  inventory InventoryStock[]\n  purchaseOrderItems PurchaseOrderItem[]\n\n  @@index([productId])",
);

schema += `\n\n${MARKER}\n\n/// Immutable commercial snapshot of what a company actually submitted for\n/// approval. Placement revalidates current price and stock, but this line remains\n/// the evidence of what was approved and why.\nmodel PurchaseOrderItem {\n  id              String   @id @default(cuid())\n  purchaseOrderId String\n  productId       String\n  variantId       String?\n  sellerId        String\n  sku             String\n  nameEn          String\n  quantity        Int\n  unitPrice       Decimal  @db.Decimal(14, 4)\n  vatRate         Decimal  @db.Decimal(5, 2)\n  lineSubtotal    Decimal  @db.Decimal(14, 2)\n  priceSourceId   String?\n  priceExplanation Json?\n  createdAt       DateTime @default(now())\n\n  purchaseOrder PurchaseOrder   @relation(fields: [purchaseOrderId], references: [id], onDelete: Cascade)\n  product       Product         @relation(fields: [productId], references: [id])\n  variant       ProductVariant? @relation(fields: [variantId], references: [id])\n\n  @@index([purchaseOrderId])\n  @@index([productId])\n  @@index([sellerId])\n}\n`;

const migration = `-- Replace header-only B2B purchase orders with governed line snapshots.\nCREATE TABLE \"PurchaseOrderItem\" (\n  \"id\" TEXT NOT NULL,\n  \"purchaseOrderId\" TEXT NOT NULL,\n  \"productId\" TEXT NOT NULL,\n  \"variantId\" TEXT,\n  \"sellerId\" TEXT NOT NULL,\n  \"sku\" TEXT NOT NULL,\n  \"nameEn\" TEXT NOT NULL,\n  \"quantity\" INTEGER NOT NULL,\n  \"unitPrice\" DECIMAL(14,4) NOT NULL,\n  \"vatRate\" DECIMAL(5,2) NOT NULL,\n  \"lineSubtotal\" DECIMAL(14,2) NOT NULL,\n  \"priceSourceId\" TEXT,\n  \"priceExplanation\" JSONB,\n  \"createdAt\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,\n  CONSTRAINT \"PurchaseOrderItem_pkey\" PRIMARY KEY (\"id\")\n);\nCREATE INDEX \"PurchaseOrderItem_purchaseOrderId_idx\" ON \"PurchaseOrderItem\"(\"purchaseOrderId\");\nCREATE INDEX \"PurchaseOrderItem_productId_idx\" ON \"PurchaseOrderItem\"(\"productId\");\nCREATE INDEX \"PurchaseOrderItem_sellerId_idx\" ON \"PurchaseOrderItem\"(\"sellerId\");\nALTER TABLE \"PurchaseOrderItem\" ADD CONSTRAINT \"PurchaseOrderItem_purchaseOrderId_fkey\" FOREIGN KEY (\"purchaseOrderId\") REFERENCES \"PurchaseOrder\"(\"id\") ON DELETE CASCADE ON UPDATE CASCADE;\nALTER TABLE \"PurchaseOrderItem\" ADD CONSTRAINT \"PurchaseOrderItem_productId_fkey\" FOREIGN KEY (\"productId\") REFERENCES \"Product\"(\"id\") ON DELETE RESTRICT ON UPDATE CASCADE;\nALTER TABLE \"PurchaseOrderItem\" ADD CONSTRAINT \"PurchaseOrderItem_variantId_fkey\" FOREIGN KEY (\"variantId\") REFERENCES \"ProductVariant\"(\"id\") ON DELETE SET NULL ON UPDATE CASCADE;\n`;

await writeFile(schemaPath, schema);
await mkdir(dirname(migrationPath), { recursive: true });
await writeFile(migrationPath, migration);
console.log("Applied governed PO-line schema and migration.");
