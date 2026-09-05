import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const srcDir = fileURLToPath(new URL("../", import.meta.url));

/**
 * A component that accepts an ICON COMPONENT must not be a client component,
 * unless it genuinely needs the client.
 *
 * `icon?: React.ElementType` means callers pass `icon={Building2}` — a
 * component reference. React cannot serialise one across the server/client
 * boundary: it finds {$$typeof, render, displayName} and throws "Functions
 * cannot be passed directly to Client Components". The page returns 500.
 *
 * The seller's /settings page did exactly that in production, and the error
 * names neither the prop nor the file, so it reads as a framework fault rather
 * than a directive nobody needed. Four components in this package carried
 * "use client" with no state, no effects and no handlers between them.
 *
 * The exception is real and narrow: a component that renders a CALLBACK prop
 * (`onClick={onCta}`) must be a client component, and its callers must be too.
 * Those are listed by name so adding one is a deliberate act rather than a
 * silent regression.
 */
const NEEDS_CLIENT = new Set([
  // Renders onClick={onCta} — a handler prop, which only a client component
  // may receive.
  "alert-card.tsx",
]);

describe("icon prop / client boundary", () => {
  const files = readdirSync(srcDir).filter((f) => f.endsWith(".tsx"));

  it.each(files)("%s does not combine an icon component prop with 'use client'", (file) => {
    const source = readFileSync(join(srcDir, file), "utf8");
    const takesIconComponent = /icon\??:\s*(React\.ElementType|LucideIcon|ComponentType)/.test(source);
    if (!takesIconComponent || NEEDS_CLIENT.has(file)) return;

    expect(
      source.trimStart().startsWith('"use client"'),
      `${file} accepts an icon COMPONENT, so a server page will pass one — "use client" here makes that a 500`,
    ).toBe(false);
  });
});
