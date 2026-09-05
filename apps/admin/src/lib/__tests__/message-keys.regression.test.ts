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

/**
 * One variable may be bound to DIFFERENT namespaces in different functions of
 * the same file — a page that binds "app" at the top and "app.section" inside a
 * child component is normal. Pairing every binding with every call then reports
 * keys as missing that resolve perfectly well under the other binding. So a key
 * counts as present when it resolves under ANY namespace that variable is bound
 * to in that file, and missing only when it resolves under none.
 */
const usages = sourceFiles(srcRoot).flatMap((file) => {
  const source = readFileSync(file, "utf8");
  const namespacesFor = new Map<string, string[]>();
  for (const [, variable, namespace] of source.matchAll(BIND)) {
    namespacesFor.set(variable, [...(namespacesFor.get(variable) ?? []), namespace!]);
  }
  return [...namespacesFor.entries()].flatMap(([variable, namespaces]) => {
    const calls = [...source.matchAll(new RegExp(`\\b${variable}\\(\\s*"([a-zA-Z0-9_.]+)"`, "g"))];
    return calls.map(([, key]) => ({
      file: file.replace(appRoot + "/", ""),
      candidates: namespaces.map((namespace) => `${namespace}.${key}`),
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
      .filter((usage) => !usage.candidates.some((path) => resolveKey(tree, path)))
      .map((usage) => `${usage.candidates[0]} (${usage.file})`);
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

  /**
   * Dynamic keys — t(`stock.${state}`) — are invisible to the scan above,
   * because it only matches string literals. That blind spot shipped:
   * `catalogue.stock` did not exist, the product card asked for
   * `stock.${availability}` on every tile, and the production build died with
   * MISSING_MESSAGE — after typecheck, lint and the whole unit suite had passed.
   *
   * The group cannot be resolved member by member without evaluating the
   * expression, but its PARENT can: if the card interpolates into `stock.`,
   * then `stock` must exist and must be a group of messages. That catches the
   * failure that actually happened — an entire group missing — in both
   * languages.
   */
  it.each([
    ["en", en as Tree],
    ["ar", ar as Tree],
  ])("every dynamically-built key has its group in %s", (_locale, tree) => {
    const missing = sourceFiles(srcRoot).flatMap((file) => {
      const source = readFileSync(file, "utf8");
      const namespacesFor = new Map<string, string[]>();
      for (const [, variable, namespace] of source.matchAll(BIND)) {
        namespacesFor.set(variable, [...(namespacesFor.get(variable) ?? []), namespace!]);
      }
      const dynamic = [...source.matchAll(/\b(\w+)\(\s*`([A-Za-z0-9_.]*?)\$\{/g)];
      return dynamic.flatMap(([, variable, prefix]) => {
        const namespaces = namespacesFor.get(variable!);
        if (!namespaces || !prefix) return [];
        const group = prefix.replace(/\.$/, "");
        const found = namespaces.some((namespace) => {
          let node: unknown = tree;
          for (const part of `${namespace}.${group}`.split(".")) {
            if (typeof node !== "object" || node === null || !(part in (node as Tree))) return false;
            node = (node as Tree)[part];
          }
          return typeof node === "object" && node !== null;
        });
        return found ? [] : [`${namespaces[0]}.${group}.* (${file.replace(appRoot + "/", "")})`];
      });
    });
    expect([...new Set(missing)]).toEqual([]);
  });


  /*
    A static check for LOOKUP-TABLE members was written here and removed.

    `adminShell.nav.items.shippingZones` reached production and rendered
    MISSING_MESSAGE on every admin page: the group existed with forty entries,
    the member did not, and the group check above cannot see that. The obvious
    fix is to read the `key: "..."` literals in a file and test each against the
    group it interpolates into.

    It does not work. A single file commonly holds two tables and two
    interpolations — admin-layout.tsx has nav GROUPS and nav ITEMS — and a regex
    cannot tell which table feeds which call, so every literal is measured
    against every group. The attempt reported about eighty misses, of which one
    was real. A guard at that signal-to-noise is deleted by the next person to
    read it, and it takes the true finding with it.

    The reliable check for this class is at RUNTIME, where next-intl actually
    resolves the key: the browser journey that walks the authenticated portals
    caught this defect in seconds. That is where it belongs, and asserting on
    MISSING_MESSAGE there is worth more than a static scan that cannot be
    trusted.
  */
});
