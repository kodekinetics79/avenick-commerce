import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import en from "../../../messages/en.json";
import ar from "../../../messages/ar.json";

const srcRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const appRoot = resolve(srcRoot, "..");

/**
 * Every translation key a component asks for must exist, in BOTH languages.
 *
 * next-intl resolves keys at render, so a missing one is not a type error and
 * not a build error — it is a broken page. A redesign added a whole `catalogue`
 * namespace of calls and thirty-two keys that were never written to the message
 * tree, which would have taken out /products, /search and every category page,
 * and no other check in this repo would have noticed.
 *
 * The scan is deliberately simple: find the local name each translator is bound
 * to, then resolve every key called through it. A namespace may itself be
 * dotted, so both halves are walked as one path.
 */
type Tree = Record<string, unknown>;

function resolveKey(tree: Tree, path: string): boolean {
  let node: unknown = tree;
  for (const part of path.split(".")) {
    if (typeof node !== "object" || node === null || !(part in (node as Tree))) return false;
    node = (node as Tree)[part];
  }
  // A key that resolves to an object is a namespace, not a message.
  return typeof node !== "object" || node === null;
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(entry) && !/\.(test|spec)\./.test(entry) ? [full] : [];
  });
}

const BIND = /const\s+(\w+)\s*=\s*(?:await\s+)?(?:getTranslations|useTranslations)\(\s*"([^"]+)"\s*\)/g;

const usages = sourceFiles(srcRoot).flatMap((file) => {
  const source = readFileSync(file, "utf8");
  const binds = [...source.matchAll(BIND)];
  return binds.flatMap(([, variable, namespace]) => {
    const calls = [...source.matchAll(new RegExp(`\\b${variable}\\(\\s*"([a-zA-Z0-9_.]+)"`, "g"))];
    return calls.map(([, key]) => ({
      file: file.replace(appRoot + "/", ""),
      path: `${namespace}.${key}`,
    }));
  });
});

describe("translation keys", () => {
  it("finds translator usages to check", () => {
    expect(usages.length).toBeGreaterThan(50);
  });

  it.each([
    ["en", en as Tree],
    ["ar", ar as Tree],
  ])("every key a component asks for exists in %s", (_locale, tree) => {
    const missing = usages
      .filter((usage) => !resolveKey(tree, usage.path))
      .map((usage) => `${usage.path} (${usage.file})`);
    expect([...new Set(missing)]).toEqual([]);
  });

  it("the two language trees carry the same keys", () => {
    const flatten = (tree: Tree, prefix = ""): string[] =>
      Object.entries(tree).flatMap(([key, value]) => {
        const path = prefix ? `${prefix}.${key}` : key;
        return typeof value === "object" && value !== null ? flatten(value as Tree, path) : [path];
      });
    const inEn = new Set(flatten(en as Tree));
    const inAr = new Set(flatten(ar as Tree));
    // A key present in one language only means that surface silently renders
    // its key path — or English — to half the market.
    expect([...inEn].filter((k) => !inAr.has(k))).toEqual([]);
    expect([...inAr].filter((k) => !inEn.has(k))).toEqual([]);
  });
});
