// mcp/src/drawing.integration.test.ts
import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { newCanvas, applyPixels, floodFill, getPixelInt } from "./piskel-bridge.js";
import { line, rect } from "./geometry.js";
import { shutdown } from "./browser.js";
import { hexToInt } from "./color.js";

describe("drawing integration", () => {
  beforeAll(async () => { await newCanvas(8, 8, "draw", 12); });
  afterAll(async () => { await shutdown(); });

  it("draws a line via geometry + applyPixels", async () => {
    const pts = line(0, 0, 3, 0).map((p) => ({ ...p, color: "#00FF00" }));
    await applyPixels(pts);
    expect(await getPixelInt(0, 0)).toBe(hexToInt("#00FF00"));
    expect(await getPixelInt(3, 0)).toBe(hexToInt("#00FF00"));
  }, 60000);

  it("flood fills an enclosed empty canvas", async () => {
    await newCanvas(4, 4, "fill", 12);
    await floodFill(0, 0, "#0000FF");
    expect(await getPixelInt(2, 2)).toBe(hexToInt("#0000FF"));
  }, 60000);
});
