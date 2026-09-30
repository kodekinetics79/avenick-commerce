#!/usr/bin/env tsx
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import { buildOpenApiDocument } from "./document";

/**
 * Emit `openapi.json`.
 *
 * The output is deterministic: `zod-to-openapi` walks the registry in
 * registration order, and this writes with a fixed indent and a trailing
 * newline. That is what lets `scripts/verify-openapi-contract.mjs` treat any
 * difference as real drift rather than formatting noise.
 */
const packageRoot = path.resolve(import.meta.dirname, "..", "..");
const outputPath = path.join(packageRoot, "openapi.json");

const document = buildOpenApiDocument();
const serialized = `${JSON.stringify(document, null, 2)}\n`;

fs.writeFileSync(outputPath, serialized, "utf8");

const pathCount = Object.keys(document.paths ?? {}).length;
const schemaCount = Object.keys(document.components?.schemas ?? {}).length;
process.stdout.write(
  `${JSON.stringify({ status: "written", file: path.relative(process.cwd(), outputPath), paths: pathCount, schemas: schemaCount, bytes: serialized.length }, null, 2)}\n`,
);
