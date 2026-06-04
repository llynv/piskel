import { describe, it, expect, afterAll } from "vitest";
import {
  newCanvas,
  applyPixels,
  getPixelInt,
  getCanvasInfo
} from "./piskel-bridge.js";
import { shutdown } from "./browser.js";
import { hexToInt } from "./color.js";

describe("bridge integration", () => {
  afterAll(async () => {
    await shutdown();
  });

  it("creates a canvas and sets a pixel", async () => {
    await newCanvas(8, 8, "test", 12);
    const info = await getCanvasInfo();
    expect(info.width).toBe(8);
    expect(info.height).toBe(8);

    await applyPixels([{ x: 1, y: 1, color: "#FF0000" }]);
    const value = await getPixelInt(1, 1);
    expect(value).toBe(hexToInt("#FF0000"));
  }, 60000);
});
