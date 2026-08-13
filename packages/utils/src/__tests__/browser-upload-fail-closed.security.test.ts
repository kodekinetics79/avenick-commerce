import { describe, expect, it } from "vitest";
import { browserDirectUploadsEnabled } from "../browser-upload-policy";

describe("browser upload security boundary", () => {
  it("fails closed while storage cannot guarantee byte and content limits", () => {
    expect(browserDirectUploadsEnabled()).toBe(false);
  });
});
