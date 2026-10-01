import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(__dirname, "../../../../..");
const source = readFileSync(join(repoRoot, "apps/seller/src/app/login/page.tsx"), "utf8");

describe("seller access surface", () => {
  it("keeps the protected auth and locale behavior on the shared portal shell", () => {
    expect(source).toContain("<PortalAccessShell");
    expect(source).toContain("safeReturnTo");
    expect(source).toContain("noValidate");
    expect(source).toContain("emailRequired");
    expect(source).toContain("passwordRequired");
    expect(source).toContain("AVENICK_LOCALE");
    expect(source).toContain('dir="ltr"');
  });
});
