// mcp/src/structure.integration.test.ts
import { describe, it, expect, afterAll, beforeAll } from "vitest";
import {
  newCanvas,
  callController,
  getCanvasInfo,
  applyPixels,
  getPalette
} from "./piskel-bridge.js";
import { shutdown } from "./browser.js";

describe("structure integration", () => {
  beforeAll(async () => {
    await newCanvas(8, 8, "struct", 12);
  });
  afterAll(async () => {
    await shutdown();
  });

  it("adds frames and layers", async () => {
    await callController("addFrameAtCurrentIndex");
    await callController("createLayer", [undefined]);
    const info = await getCanvasInfo();
    expect(info.frameCount).toBeGreaterThanOrEqual(2);
    expect(info.layerCount).toBeGreaterThanOrEqual(2);
  }, 60000);

  it("reports used palette colors", async () => {
    await applyPixels([{ x: 0, y: 0, color: "#FF0000" }]);
    const palette = await getPalette();
    expect(palette.length).toBeGreaterThanOrEqual(1);
  }, 60000);
});
