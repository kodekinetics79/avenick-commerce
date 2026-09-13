import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import en from "../../../messages/en.json";
import ar from "../../../messages/ar.json";

const srcRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const appRoot = resolve(srcRoot, "..");

/**
 * A message that takes an argument is never called without one.
 *
 * THE DEFECT. `catalogue.title.category` is "{category}", and /products called
 * `t("title.category")` with nothing to put in it. next-intl does not throw on
 * that: it prints its fallback, which is the KEY PATH. So every
 * /products?category=… page — the destination of every category chip, facet
 * link and search pill — carried "catalogue.title.category" as its h1 and its
 * tab title, on a build whose message-key test was green, because the key
 * existed. Existence was checked; the argument was not.
 *
 * The scan mirrors message-keys.regression.test.ts: find what each translator
 * is bound to, then look at every call made through it with a literal key and
 * NO second argument. If that message, in either language, names an ICU
 * argument — `{category}`, `{count, plural, …}` — the call is a raw key waiting
 * to render.
 */
type Tree = Record<string, unknown>;

function message(tree: Tree, path: string): string | undefined {
  let node: unknown = tree;
  for (const part of path.split(".")) {
    if (typeof node !== "object" || node === null || !(part in (node as Tree))) return undefined;
    node = (node as Tree)[part];
  }
  return typeof node === "string" ? node : undefined;
}

/** `{name}` or `{name, plural, …}` — an argument the caller must supply. */
const ICU_ARGUMENT = /\{\s*[A-Za-z_]\w*\s*[,}]/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(entry) && !/\.(test|spec)\./.test(entry) ? [full] : [];
  });
}

const BIND = /const\s+(\w+)\s*=\s*(?:await\s+)?(?:getTranslations|useTranslations)\(\s*"([^"]+)"\s*\)/g;

interface BareCall {
  file: string;
  key: string;
}

const bareCalls: BareCall[] = sourceFiles(srcRoot).flatMap((file) => {
  const source = readFileSync(file, "utf8");
  const namespacesFor = new Map<string, string[]>();
  for (const [, variable, namespace] of source.matchAll(BIND)) {
    namespacesFor.set(variable!, [...(namespacesFor.get(variable!) ?? []), namespace!]);
  }
  return [...namespacesFor.entries()].flatMap(([variable, namespaces]) =>
    [...source.matchAll(new RegExp(`\\b${variable}\\(\\s*"([a-zA-Z0-9_.]+)"\\s*\\)`, "g"))].flatMap(([, key]) => {
      const path = namespaces
        .map((namespace) => `${namespace}.${key}`)
        .find((candidate) => message(en as Tree, candidate) !== undefined || message(ar as Tree, candidate) !== undefined);
      return path ? [{ file: file.replace(appRoot + "/", ""), key: path }] : [];
    }),
  );
});

/**
 * ONE KNOWN CALL, AND IT MAY ONLY SHRINK. /products' generateMetadata still
 * titles a category page with the bare key; that block is owned by a separate
 * change that names the category the way the h1 now does. Once it lands this
 * entry is dead and should be deleted — the test keeps passing either way, and
 * a SECOND bare call to this message anywhere still fails it.
 */
const PENDING: Record<string, number> = {
  "src/app/products/page.tsx catalogue.title.category": 1,
};

describe("message arguments", () => {
  it("finds bare translator calls to check", () => {
    // A scan that silently matched nothing would pass forever.
    expect(bareCalls.length).toBeGreaterThan(50);
  });

  it("never calls a message that takes an argument without one", () => {
    const counts = new Map<string, number>();
    const offending: string[] = [];
    for (const call of bareCalls) {
      const needsArgument = [en as Tree, ar as Tree].some((tree) => ICU_ARGUMENT.test(message(tree, call.key) ?? ""));
      if (!needsArgument) continue;
      const id = `${call.file} ${call.key}`;
      const seen = (counts.get(id) ?? 0) + 1;
      counts.set(id, seen);
      if (seen > (PENDING[id] ?? 0)) offending.push(id);
    }
    expect(offending, "these render their key path instead of a sentence").toEqual([]);
  });

  it("names the category on /products rather than printing the key", () => {
    const page = readFileSync(join(srcRoot, "app/products/page.tsx"), "utf8");
    const body = page.slice(page.indexOf("export default async function ProductsPage"));
    expect(body, "the h1 calls title.category without a category").not.toMatch(/t\(\s*"title\.category"\s*\)/);
    expect(page).toMatch(/t\(\s*"title\.category",\s*\{\s*category:/);
  });
});
