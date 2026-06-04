import { describe, it, expect } from "vitest";
import { line, rect, ellipse } from "./geometry.js";

const sort = (ps: Array<{ x: number; y: number }>) =>
  [...ps].sort((a, b) => a.y - b.y || a.x - b.x);

describe("geometry", () => {
  it("draws a horizontal line", () => {
    expect(sort(line(0, 0, 2, 0))).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 }
    ]);
  });
  it("draws a diagonal line", () => {
    expect(sort(line(0, 0, 2, 2))).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 2 }
    ]);
  });
  it("draws a rect outline", () => {
    const pts = sort(rect(0, 0, 3, 3, false));
    expect(pts).toContainEqual({ x: 0, y: 0 });
    expect(pts).toContainEqual({ x: 2, y: 2 });
    expect(pts).not.toContainEqual({ x: 1, y: 1 });
    expect(pts.length).toBe(8);
  });
  it("draws a filled rect", () => {
    expect(rect(0, 0, 2, 2, true).length).toBe(4);
  });
  it("draws an ellipse outline within bounds", () => {
    const pts = ellipse(0, 0, 5, 5, false);
    expect(pts.length).toBeGreaterThan(0);
    for (const p of pts) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThan(5);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThan(5);
    }
  });
});
