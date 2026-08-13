import { readFile, writeFile, unlink } from "node:fs/promises";

async function patchB2B() {
  const path = "packages/database/src/services/b2b-purchase-orders.ts";
  let source = await readFile(path, "utf8");
  source = source.replace(
    'import type { Currency, Prisma } from "@prisma/client";',
    'import { AuditAction, type Currency, type Prisma } from "@prisma/client";',
  );
  source = source.replaceAll('action: "CREATE",', 'action: AuditAction.CREATE,');
  source = source.replaceAll('action: "STATUS_CHANGE",', 'action: AuditAction.STATUS_CHANGE,');
  await writeFile(path, source);
}

async function patchCatalog() {
  const path = "packages/database/src/services/pilot-catalog.ts";
  let source = await readFile(path, "utf8");
  source = source.replace(
    '  ProductIssueType,\n',
    '  AuditAction,\n  ProductIssueType,\n',
  );
  source = source.replaceAll('action: "CREATE",', 'action: AuditAction.CREATE,');

  const start = source.indexOf("function commercialPayload(row: PilotCatalogRecord): Prisma.InputJsonValue {");
  const endMarker = "\n}\n\nasync function upsertProduct";
  const end = source.indexOf(endMarker, start);
  if (start < 0 || end < 0) throw new Error("commercialPayload function anchor not found");
  const replacement = `function commercialPayload(row: PilotCatalogRecord): Prisma.InputJsonValue {
  // Prisma distinguishes database-null sentinels from JSON null at the type
  // level. Round-tripping through JSON produces a plain, serializable JSON value
  // while preserving explicit nulls inside the source-evidence object.
  const payload = {
    filterElements: clean(row.filterElements) ?? null,
    maxVolumeLeadTime: clean(row.maxVolumeLeadTime) ?? null,
    dimensionsCm: row.dimensionsCm ?? null,
    netWeightKg: row.netWeightKg ?? null,
    grossWeightKg: row.grossWeightKg ?? null,
    cbm: row.cbm ?? null,
    priceValidity: row.priceValidity ?? null,
    assetKey: row.assetKey ?? null,
    assets: row.assets ?? null,
  };
  return JSON.parse(JSON.stringify(payload)) as Prisma.InputJsonValue;
}`;
  source = source.slice(0, start) + replacement + source.slice(end + 2);
  await writeFile(path, source);
}

await patchB2B();
await patchCatalog();

for (const path of [
  ".github/workflows/fix-pilot-typecheck.yml",
  "scripts/fix-pilot-typecheck.mjs",
]) {
  try { await unlink(path); } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

console.log("Prisma type-contract repairs applied.");
