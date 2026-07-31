import { describe, expect, it } from "vitest";
import { safeCallbackPath } from "./safe-callback-url";

describe("safeCallbackPath", () => {
  it.each([
    ["/b2b/spatial-commerce", "/b2b/spatial-commerce"],
    ["/products?q=bearing#results", "/products?q=bearing#results"],
  ])("preserves a same-origin path", (input, expected) => {
    expect(safeCallbackPath(input)).toBe(expected);
  });

  it.each([
    null,
    "",
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "/%5cevil.example",
    "/\u0000evil",
  ])("rejects unsafe callback %j", (input) => {
    expect(safeCallbackPath(input)).toBe("/account/orders");
  });
});
