import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const uiSrc = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * A "use client" module may export components. It must not export a plain
 * function a server component would call.
 *
 * Next replaces every export of a client module with a client reference in the
 * server graph. A React component survives that — the server renders it rather
 * than calling it — but a helper does not: invoking one throws
 *
 *     TypeError: (0 , d.dc) is not a function
 *
 * during page-data collection, naming a minified symbol and no file. That is
 * exactly how the seller build broke: `buttonVariants` was exported from the
 * "use client" button module and called by the seller messages page. Typecheck
 * cannot see it, because the types are identical on both sides of the boundary,
 * and no unit test catches it because it only appears in a production build.
 *
 * The rule: variant functions, styling helpers and pure utilities live in a
 * module with no directive. A client module may re-export them.
 */
const CLIENT_MODULES = readdirSync(uiSrc)
  .filter((file) => /\.tsx?$/.test(file) && !file.endsWith(".d.ts"))
  .filter((file) => readFileSync(resolve(uiSrc, file), "utf8").trimStart().startsWith('"use client"'));

describe("client/server boundary", () => {
  it("finds the client modules it is meant to police", () => {
    expect(CLIENT_MODULES.length).toBeGreaterThan(0);
  });

  it.each(CLIENT_MODULES)("%s exports no callable helper", (file) => {
    const source = readFileSync(resolve(uiSrc, file), "utf8");
    const offenders: string[] = [];

    // `export const foo = cva(...)` — a value the caller invokes. A component is
    // PascalCase and is rendered, never called, so the lowercase start is the
    // signal that this is a helper.
    for (const match of source.matchAll(/^export const ([a-z][A-Za-z0-9_]*)\s*=\s*(?:cva|cx|clsx|tv)\s*\(/gm)) {
      offenders.push(match[1]!);
    }
    for (const match of source.matchAll(/^export (?:async )?function ([a-z][A-Za-z0-9_]*)\s*\(/gm)) {
      // A hook is exempt. `useThing` can only ever be called from a client
      // component, so it cannot be the server-side call this guard is about,
      // and a client module is exactly where a hook belongs.
      if (/^use[A-Z]/.test(match[1]!)) continue;
      offenders.push(match[1]!);
    }
    // A re-export (`export { x } from "./y"`) is fine: the server imports the
    // definition module, which carries no directive.

    expect(
      offenders,
      `${file} is "use client" and exports ${offenders.join(", ")} — move to a module with no directive and re-export`,
    ).toEqual([]);
  });
});
