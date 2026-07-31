import { describe, expect, it } from "vitest";
import { shouldReduceSpatialMotion } from "./motion-policy";

describe("shouldReduceSpatialMotion", () => {
  it.each([
    [{ reducedMotion: false, coarsePointer: false, saveData: false }, false],
    [{ reducedMotion: true, coarsePointer: false, saveData: false }, true],
    [{ reducedMotion: false, coarsePointer: true, saveData: false }, true],
    [{ reducedMotion: false, coarsePointer: false, saveData: true }, true],
  ])("resolves motion preferences", (signals, expected) => {
    expect(shouldReduceSpatialMotion(signals)).toBe(expected);
  });
});
