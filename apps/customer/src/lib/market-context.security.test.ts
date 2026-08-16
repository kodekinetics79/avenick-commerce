import { describe, expect, it } from "vitest";
import { emptyMarketAddress, SUPPORTED_COUNTRIES } from "./market-context";

describe("market context defaults", () => {
  it("does not infer a customer's country or city", () => {
    expect(emptyMarketAddress("Home")).toEqual({ label: "Home", line1: "", city: "", country: "" });
  });

  it("offers supported countries without selecting one implicitly", () => {
    expect(SUPPORTED_COUNTRIES).toContainEqual(["AE", "United Arab Emirates"]);
    expect(SUPPORTED_COUNTRIES).toContainEqual(["SA", "Saudi Arabia"]);
  });
});
