import { readFile, stat } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { extname, resolve } from "node:path";
import {
  applyPilotCatalog,
  validatePilotCatalog,
  type PilotCatalogFile,
} from "../src/services/pilot-catalog";

const MAX_IMPORT_BYTES = 8 * 1024 * 1024;
const MAX_DECOMPRESSED_BYTES = 32 * 1024 * 1024;

async function load(path: string): Promise<PilotCatalogFile> {
  const metadata = await stat(path);
  if (metadata.size === 0 || metadata.size > MAX_IMPORT_BYTES) {
    throw new Error("Catalog file is empty or exceeds the 8 MB import limit");
  }
  const bytes = await readFile(path);
  const raw = extname(path).toLowerCase() === ".gz"
    ? gunzipSync(bytes, { maxOutputLength: MAX_DECOMPRESSED_BYTES })
    : bytes;
  if (raw.byteLength > MAX_DECOMPRESSED_BYTES) {
    throw new Error("Catalog expands beyond the 32 MB decompressed limit");
  }
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
    console.error(validation.errors.slice(0, 50).join("\n"));
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
  const actorId = process.env.PILOT_IMPORT_ACTOR_ID?.trim();
  if (!actorId) {
    throw new Error("Refusing write: PILOT_IMPORT_ACTOR_ID must identify the authenticated administrator or import service");
  }

  const result = await applyPilotCatalog(file, {
    actorId,
    assetBaseUrl: process.env.PILOT_ASSET_BASE_URL?.trim() || undefined,
    testPassword: process.env.PILOT_TEST_PASSWORD?.trim() || undefined,
  });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
