import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const textareaSource = readFileSync(join(__dirname, "..", "textarea.tsx"), "utf8");
const cssSource = readFileSync(join(__dirname, "..", "globals.css"), "utf8");

describe("shared form and scrolling surfaces", () => {
  it("keeps long-text fields stable while providing useful writing room", () => {
    expect(textareaSource).toContain("min-h-[120px]");
    expect(textareaSource).toContain("resize-none");
    expect(textareaSource).not.toContain("resize-y");
  });

  it("themes application scrollbars without requiring an opt-in class", () => {
    expect(cssSource).toMatch(/html\s*\{[\s\S]*scrollbar-color:/);
    expect(cssSource).toMatch(/html\s*\{[\s\S]*scrollbar-width:\s*thin/);
    expect(cssSource).toContain(":where(html, body, body *)::-webkit-scrollbar-thumb");
  });

  it("returns scrollbar colors to the operating system in forced-colors mode", () => {
    expect(cssSource).toMatch(/@media \(forced-colors: active\)[\s\S]*scrollbar-color:\s*auto/);
  });
});
