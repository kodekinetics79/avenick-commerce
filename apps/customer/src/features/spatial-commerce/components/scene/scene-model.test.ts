import { describe, expect, it } from "vitest";
import { PULSE_DURATION_MS, SPATIAL_ASSEMBLY_NODES, spatialPulseEnvelope } from "./scene-model";

describe("spatial scene model", () => {
  it("keeps mechanical assembly node ids stable and unique", () => {
    const ids = SPATIAL_ASSEMBLY_NODES.map((node) => node.id);
    expect(ids).toEqual(["mounting-plate", "motor-housing", "drive-shaft", "output-coupling"]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("uses a bounded pulse inside the requested duration window", () => {
    expect(PULSE_DURATION_MS).toBeGreaterThanOrEqual(500);
    expect(PULSE_DURATION_MS).toBeLessThanOrEqual(800);
    expect(spatialPulseEnvelope(0)).toBe(0);
    expect(spatialPulseEnvelope(PULSE_DURATION_MS)).toBe(0);
    expect(spatialPulseEnvelope(PULSE_DURATION_MS / 2)).toBeCloseTo(1);
    expect(spatialPulseEnvelope(Number.NaN)).toBe(0);
  });
});
