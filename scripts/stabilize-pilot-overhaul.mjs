import { readFile, writeFile, unlink } from "node:fs/promises";

async function replace(path, needle, replacement) {
  const source = await readFile(path, "utf8");
  if (!source.includes(needle)) throw new Error(`Expected cleanup anchor missing in ${path}`);
  await writeFile(path, source.replace(needle, replacement));
}

await replace(
  "packages/database/src/services/pilot-catalog.ts",
  '        action: "IMPORT",',
  '        action: "CREATE",',
);

const poPath = "packages/database/src/services/b2b-purchase-orders.ts";
let po = await readFile(poPath, "utf8");
po = po.replace(/\nasync function assertApprovedPriceSnapshotStillCurrent[\s\S]*?\n}\n\n\/\*\*/m, "\n/**");
await writeFile(poPath, po);

const indexPath = "packages/database/src/index.ts";
let index = await readFile(indexPath, "utf8");
if (!index.includes('export * from "./services/pilot-catalog";')) {
  index = index.replace(
    'export * from "./services/promotions";\n',
    'export * from "./services/promotions";\nexport * from "./services/pilot-catalog";\n',
  );
}
await writeFile(indexPath, index);

const importer = `import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { extname, resolve } from "node:path";
import {
  applyPilotCatalog,
  validatePilotCatalog,
  type PilotCatalogFile,
} from "../src/services/pilot-catalog";

async function load(path: string): Promise<PilotCatalogFile> {
  const bytes = await readFile(path);
  const raw = extname(path).toLowerCase() === ".gz" ? gunzipSync(bytes) : bytes;
  return JSON.parse(raw.toString("utf8")) as PilotCatalogFile;
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const fileArg = args.find((arg) => !arg.startsWith("--"));
  if (!fileArg) throw new Error("Usage: pnpm db:import-pilot <catalog.json|catalog.json.gz> [--apply]");

  const file = await load(resolve(process.cwd(), fileArg));
  const validation = validatePilotCatalog(file);
  console.log(JSON.stringify({
    rows: file.records?.length ?? 0,
    sellerCounts: validation.counts,
    verifiedPriceRows: validation.verifiedPriceRows,
    sourceStockRows: validation.sourceStockRows,
    mediaMappedRows: validation.mediaMappedRows,
    warnings: validation.warnings.length,
    errors: validation.errors.length,
  }, null, 2));

  if (validation.errors.length) {
    console.error(validation.errors.slice(0, 50).join("\\n"));
    throw new Error("Pilot catalog validation failed");
  }
  if (!apply) {
    console.log("Dry run complete. Re-run with --apply to write the catalog.");
    return;
  }
  if (process.env.PILOT_CATALOG_IMPORT !== "1") {
    throw new Error("Refusing write: set PILOT_CATALOG_IMPORT=1 for an explicit pilot import");
  }
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_PILOT_CATALOG_IMPORT !== "1") {
    throw new Error("Refusing production import: ALLOW_PILOT_CATALOG_IMPORT=1 is required for the designated pilot database");
  }

  const result = await applyPilotCatalog(file, {
    assetBaseUrl: process.env.PILOT_ASSET_BASE_URL?.trim() || undefined,
    testPassword: process.env.PILOT_TEST_PASSWORD?.trim() || undefined,
  });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
`;
await writeFile("packages/database/prisma/import-pilot-catalog.ts", importer);

for (const path of [
  "scripts/apply-pilot-commerce-schema.mjs",
  "scripts/apply-governed-po-lines.mjs",
  ".github/workflows/apply-governed-po-lines.yml",
  ".github/workflows/stabilize-pilot-overhaul.yml",
  "scripts/stabilize-pilot-overhaul.mjs",
]) {
  try { await unlink(path); } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

console.log("Pilot overhaul cleanup materialized.");
