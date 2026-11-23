import { describe, expect, it } from "vitest";
import { contrast, contrastPairs, light } from "../theme/tokens";

describe("WCAG contrast of the theme tokens", () => {
  for (const p of contrastPairs) {
    it(`${p.name} ≥ ${p.min}:1`, () => {
      expect(contrast(p.fg, p.bg)).toBeGreaterThanOrEqual(p.min);
    });
  }
  it("white text on yellow is NOT used (fails AA) — guard against regressions", () => {
    expect(contrast("#FFFFFF", light.yellow)).toBeLessThan(3);
  });
  it("red text on yellow would fail AA (so red never sits on yellow)", () => {
    expect(contrast(light.red, light.yellow)).toBeLessThan(4.5);
  });
});
