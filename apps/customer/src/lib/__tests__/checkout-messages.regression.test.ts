import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { COUNTRY_VALUES } from "@avenick/types/schemas";
import en from "../../../messages/en.json";
import ar from "../../../messages/ar.json";
import { ORDER_STATUS_VALUES, PAYMENT_METHOD_VALUES, whatHappensNext } from "../checkout-order-record";

/**
 * The checkout and its confirmation read their copy through `copyFrom`, which
 * renders the English source string whenever a key is absent from the tree.
 * That is the right failure mode for a buyer — never a raw key path — but it
 * is also invisible: the general message-keys scan only sees translators bound
 * by `useTranslations("ns")`, so a checkout key missing from ar.json would
 * ship as English on the last screen before money moves, and nothing would
 * fail. This scan reads every key the checkout surfaces reference, static or
 * built from an enum, and demands it in BOTH trees — with the same ICU
 * parameters, so a translation cannot silently drop `{moq}` from the sentence
 * that states the minimum order quantity.
 */
type Tree = Record<string, unknown>;

const srcRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const OWNED = [
  "components/checkout/checkout-form.tsx",
  "components/checkout/checkout-summary.tsx",
  "components/checkout/checkout-trust-strip.tsx",
  "components/checkout/order-confirmation.tsx",
  "components/checkout/payment-methods.ts",
  "app/checkout/page.tsx",
  "app/account/orders/page.tsx",
].map((file) => resolve(srcRoot, file));

function lookup(tree: Tree, path: string): unknown {
  let node: unknown = tree;
  for (const part of path.split(".")) {
    if (typeof node !== "object" || node === null || !(part in (node as Tree))) return undefined;
    node = (node as Tree)[part];
  }
  return node;
}

const isMessage = (tree: Tree, path: string) => typeof lookup(tree, path) === "string";
const isGroup = (tree: Tree, path: string) => typeof lookup(tree, path) === "object" && lookup(tree, path) !== null;

const sources = OWNED.map((file) => ({ file, source: readFileSync(file, "utf8") }));

/** `c("checkout.x", …)` and `key: "checkout.x"` / `labelKey` / `descKey` literals. */
const staticKeys = [...new Set(sources.flatMap(({ source }) => [
  ...[...source.matchAll(/\bc\(\s*"((?:checkout|orders)\.[A-Za-z0-9_.]+)"/g)].map((m) => m[1]!),
  ...[...source.matchAll(/\b(?:key|labelKey|descKey):\s*"((?:checkout|orders)\.[A-Za-z0-9_.]+)"/g)].map((m) => m[1]!),
]))];

/** Keys built from an enum value, resolved member by member against the enum. */
const enumKeys = [
  ...COUNTRY_VALUES.map((country) => `checkout.countries.${country}`),
  ...ORDER_STATUS_VALUES.map((status) => `orders.stage.${status}`),
  ...[...new Set([
    ...ORDER_STATUS_VALUES.map((status) => whatHappensNext(status, null)),
    whatHappensNext("PENDING_PAYMENT", "BANK_TRANSFER"),
  ])].map((key) => `orders.next.${key}`),
];

/**
 * The SET of parameter names, not the multiset: an Arabic plural carries six
 * forms and only some of them print `{n}`, so counting occurrences would fail
 * a correct translation. What must match is which parameters exist.
 */
const icuParams = (message: string) =>
  [...new Set([...message.matchAll(/\{\s*([A-Za-z0-9_]+)\s*[,}]/g)].map((m) => m[1]!))].sort();

describe("checkout message keys", () => {
  it("finds the checkout's own copy to check", () => {
    expect(staticKeys.length).toBeGreaterThan(100);
    expect(PAYMENT_METHOD_VALUES.length).toBe(6);
  });

  it.each([
    ["en", en as Tree],
    ["ar", ar as Tree],
  ])("every key the checkout surfaces reference exists in %s", (_locale, tree) => {
    const missing = [...staticKeys, ...enumKeys].filter((key) => !isMessage(tree, key));
    expect(missing).toEqual([]);
  });

  it.each([
    ["en", en as Tree],
    ["ar", ar as Tree],
  ])("every group the checkout builds keys into is a group in %s", (_locale, tree) => {
    const groups = [...new Set(sources.flatMap(({ source }) =>
      [...source.matchAll(/\b[cm]\(\s*`((?:checkout|orders)\.[A-Za-z0-9_.]*?)\.\$\{/g)].map((m) => m[1]!),
    ))];
    // The order-history page binds `m` to the "orders" namespace and builds
    // `stage.*` and `next.*` under it.
    const namespaced = [...new Set(sources.flatMap(({ source }) =>
      [...source.matchAll(/\bm\(\s*`(stage|next)\.\$\{/g)].map((m) => `orders.${m[1]!}`),
    ))];
    expect(groups.length + namespaced.length).toBeGreaterThan(0);
    expect([...groups, ...namespaced].filter((group) => !isGroup(tree, group))).toEqual([]);
  });

  it("carries the same ICU parameters in both languages", () => {
    const mismatched = [...staticKeys, ...enumKeys]
      .filter((key) => isMessage(en as Tree, key) && isMessage(ar as Tree, key))
      .filter((key) => icuParams(lookup(en as Tree, key) as string).join() !== icuParams(lookup(ar as Tree, key) as string).join())
      .map((key) => `${key}: en{${icuParams(lookup(en as Tree, key) as string)}} ar{${icuParams(lookup(ar as Tree, key) as string)}}`);
    expect(mismatched).toEqual([]);
  });

  it("uses typographic apostrophes, which ICU cannot mistake for quoting", () => {
    const straight = [...staticKeys, ...enumKeys].filter((key) => {
      const message = lookup(en as Tree, key);
      return typeof message === "string" && message.includes("'");
    });
    expect(straight).toEqual([]);
  });
});
