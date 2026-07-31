import { describe, expect, it } from "vitest";
import { B2B_MODE_CONTRACTS, B2B_SPATIAL_MODES } from "./contracts";

describe("B2B mode contracts", () => {
  it("defines a complete contract for every supported mode", () => {
    expect(Object.keys(B2B_MODE_CONTRACTS).sort()).toEqual([...B2B_SPATIAL_MODES].sort());
    for (const mode of B2B_SPATIAL_MODES) {
      expect(B2B_MODE_CONTRACTS[mode].mode).toBe(mode);
    }
  });

  it("limits inspect and procure to one selection", () => {
    expect(B2B_MODE_CONTRACTS.inspect.selectionLimit).toBe(1);
    expect(B2B_MODE_CONTRACTS.procure.selectionLimit).toBe(1);
    expect(B2B_MODE_CONTRACTS.compare.allowsMultipleSelection).toBe(true);
  });
});
