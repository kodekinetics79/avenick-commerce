/**
 * `pnpm --filter @avenick/design-tokens tokens:generate`
 *
 * Reads packages/ui/src/globals.css and writes three artefacts:
 *
 *   apps/mobile/lib/theme/tokens.g.dart     the Flutter ThemeExtension
 *   packages/design-tokens/dist/tokens.json the plain extraction
 *   packages/design-tokens/src/generated/   the same, typed, for web tooling
 *
 * Then it prints the web/mobile delta. Everything Flutter cannot represent —
 * every inset shadow layer, every RTL override that does not cross — is listed
 * on stdout on every single run. A delta that is printed is a delta somebody can
 * argue with; a delta that is silent is just a bug with a long fuse.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { emitDart } from "./dart";
import { extractTokens, type TokenExtraction } from "./extract";
import {
  DART_OUTPUT_RELATIVE,
  GLOBALS_CSS_RELATIVE,
  JSON_OUTPUT_RELATIVE,
  TS_OUTPUT_RELATIVE,
  repoRoot,
} from "./paths";
import type { GenerationWarning } from "./values";

const PACKAGE_NAME = "@avenick/design-tokens";

export interface GenerateResult {
  readonly extraction: TokenExtraction;
  readonly dartPath: string;
  readonly jsonPath: string;
  readonly tsPath: string;
  readonly fieldCount: number;
  readonly warnings: readonly GenerationWarning[];
}

export function generate(root: string = repoRoot()): GenerateResult {
  const cssPath = path.join(root, GLOBALS_CSS_RELATIVE);
  const css = readFileSync(cssPath, "utf8");

  const extraction = extractTokens(css, GLOBALS_CSS_RELATIVE);
  const dart = emitDart(extraction, PACKAGE_NAME);

  const dartPath = path.join(root, DART_OUTPUT_RELATIVE);
  const jsonPath = path.join(root, JSON_OUTPUT_RELATIVE);
  const tsPath = path.join(root, TS_OUTPUT_RELATIVE);

  writeFile(dartPath, dart.code);
  writeFile(jsonPath, `${JSON.stringify(extraction, null, 2)}\n`);
  writeFile(tsPath, typedExport(extraction));

  return {
    extraction,
    dartPath,
    jsonPath,
    tsPath,
    fieldCount: dart.fieldCount,
    warnings: extraction.warnings,
  };
}

function writeFile(target: string, contents: string): void {
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, contents, "utf8");
}

function typedExport(extraction: TokenExtraction): string {
  return [
    "// GENERATED — DO NOT EDIT.",
    "//",
    `// Written by ${PACKAGE_NAME} from ${extraction.source.file}.`,
    "// Run `pnpm --filter @avenick/design-tokens tokens:generate` to refresh.",
    "//",
    "// This is the same extraction as dist/tokens.json, typed, so web tooling and",
    "// tests read exactly what the Flutter theme was generated from rather than a",
    "// second reading of the stylesheet.",
    "",
    'import type { TokenExtraction } from "../extract";',
    "",
    `export const meridianTokens: TokenExtraction = ${JSON.stringify(extraction, null, 2)};`,
    "",
    "export default meridianTokens;",
    "",
  ].join("\n");
}

/* ── CLI ────────────────────────────────────────────────────────────────── */

function report(result: GenerateResult): void {
  const { extraction } = result;
  const relative = (absolute: string) => path.relative(repoRoot(), absolute);

  console.log(`${PACKAGE_NAME} — generated from ${extraction.source.file}`);
  console.log(`  sha256          ${extraction.source.sha256}`);
  console.log(`  tokens          ${result.fieldCount} light · ${extraction.darkOverrides.length} dark overrides`);
  console.log(
    `  posture deltas  seller ${Object.keys(extraction.portalSeller).length} · ` +
      `admin ${Object.keys(extraction.portalAdmin).length} · ` +
      `reduced-motion ${Object.keys(extraction.reducedMotion).length}`,
  );
  console.log(`  rtl (emitted)   ${Object.keys(extraction.rtl).length}`);
  console.log(`  @property       ${extraction.registeredProperties.length} registered`);
  console.log("");
  console.log(`  → ${relative(result.dartPath)}`);
  console.log(`  → ${relative(result.jsonPath)}`);
  console.log(`  → ${relative(result.tsPath)}`);

  const insets = result.warnings.filter((w) => w.kind === "inset-shadow-dropped");
  console.log("");
  console.log(`INSET SHADOW LAYERS DROPPED — ${insets.length}`);
  if (insets.length === 0) {
    console.log("  (none)");
  } else {
    console.log("  Flutter's BoxShadow paints outside the box only. Meridian's light model puts");
    console.log("  the highlight seam and the counter-fresnel underside INSIDE it, so these");
    console.log("  layers have no equivalent and the mobile surface will read flatter than the");
    console.log("  web one until something reimplements them (a decorated child or a painter).");
    console.log("");
    for (const warning of insets) {
      console.log(`  ${pad(warning.scope, 14)} ${pad(warning.property, 10)} line ${pad(String(warning.line), 5)} ${warning.detail}`);
    }
  }

  const rtl = result.warnings.filter((w) => w.kind === "rtl-delta-not-emitted");
  if (rtl.length > 0) {
    console.log("");
    console.log(`RTL OVERRIDES NOT EMITTED — ${rtl.length}`);
    for (const warning of rtl) {
      console.log(`  ${pad(warning.property, 16)} line ${pad(String(warning.line), 5)} ${warning.detail.split(" — ")[0]}`);
    }
  }

  const approximations = result.warnings.filter((w) => w.kind === "approximated-on-flutter");
  if (approximations.length > 0) {
    console.log("");
    console.log(`APPROXIMATED ON FLUTTER — ${approximations.length}`);
    for (const warning of approximations) {
      console.log(`  ${pad(warning.property, 16)} ${warning.detail}`);
    }
  }
}

function pad(text: string, width: number): string {
  return text.length >= width ? text : text + " ".repeat(width - text.length);
}

const invokedDirectly = /(^|[\\/])generate\.(ts|js|mts|cts|mjs|cjs)$/.test(process.argv[1] ?? "");
if (invokedDirectly) {
  try {
    report(generate());
  } catch (error) {
    console.error("");
    console.error(error instanceof Error ? error.message : String(error));
    console.error("");
    process.exitCode = 1;
  }
}
