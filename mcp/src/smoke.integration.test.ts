// mcp/src/smoke.integration.test.ts
// End-to-end smoke test: drives the live Piskel bridge through a full,
// realistic workflow (draw -> frames -> layers -> serialize/load -> export ->
// undo/redo) against a real browser, then tears the session down.
import { describe, it, expect, afterAll } from "vitest";
import {
  newCanvas,
  applyPixels,
  getPixelInt,
  getCanvasInfo,
  callController,
  serializePiskel,
  loadPiskelString,
  renderPng,
  renderSpritesheet,
  renderGif,
  undo,
  redo
} from "./piskel-bridge.js";
import { shutdown } from "./browser.js";
import { hexToInt } from "./color.js";
import { line } from "./geometry.js";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("smoke integration (full workflow)", () => {
  afterAll(async () => {
    await shutdown();
  });

  it("draws, animates, serializes, exports, and undoes/redoes", async () => {
    // 1. Fresh 16x16 canvas
    await newCanvas(16, 16, "smoke", 12);
    let info = await getCanvasInfo();
    expect(info.width).toBe(16);
    expect(info.height).toBe(16);

    // 2. Draw a few pixels + a geometry line, then read one back
    const linePts = line(2, 2, 10, 2).map((p) => ({ ...p, color: "#FF8800" }));
    await applyPixels([
      { x: 0, y: 0, color: "#FF0000" },
      { x: 15, y: 15, color: "#00FF00" },
      { x: 5, y: 8, color: "#0000FF" },
      ...linePts
    ]);
    expect(await getPixelInt(0, 0)).toBe(hexToInt("#FF0000"));
    expect(await getPixelInt(5, 8)).toBe(hexToInt("#0000FF"));
    expect(await getPixelInt(2, 2)).toBe(hexToInt("#FF8800"));
    expect(await getPixelInt(10, 2)).toBe(hexToInt("#FF8800"));

    // 3. Add a frame -> frameCount >= 2
    await callController("addFrameAtCurrentIndex");
    info = await getCanvasInfo();
    expect(info.frameCount).toBeGreaterThanOrEqual(2);

    // 4. Add a layer -> layerCount >= 2
    await callController("createLayer");
    info = await getCanvasInfo();
    expect(info.layerCount).toBeGreaterThanOrEqual(2);

    // 5. Serialize -> contains modelVersion; reload -> still 16x16
    const serialized = await serializePiskel();
    expect(serialized).toContain("modelVersion");
    await loadPiskelString(serialized);
    info = await getCanvasInfo();
    expect(info.width).toBe(16);
    expect(info.height).toBe(16);

    // 6. Render exports into Buffers (no files) and check magic bytes
    const pngB64 = await renderPng(4);
    const png = Buffer.from(pngB64, "base64");
    expect(png.length).toBeGreaterThan(0);
    // PNG magic: 89 50 4E 47
    expect([png[0], png[1], png[2], png[3]]).toEqual([0x89, 0x50, 0x4e, 0x47]);

    const ssB64 = await renderSpritesheet(4);
    const ss = Buffer.from(ssB64, "base64");
    expect(ss.length).toBeGreaterThan(0);
    expect([ss[0], ss[1], ss[2], ss[3]]).toEqual([0x89, 0x50, 0x4e, 0x47]);

    const gifB64 = await renderGif(4);
    const gif = Buffer.from(gifB64, "base64");
    expect(gif.length).toBeGreaterThan(0);
    // GIF magic: "GIF8"
    expect(gif.subarray(0, 4).toString("ascii")).toBe("GIF8");

    // 7. Undo then redo. Give Piskel's history snapshot interval a moment.
    await delay(600);
    await applyPixels([{ x: 1, y: 1, color: "#FFFFFF" }]);
    await delay(600);
    expect(await undo()).toBe(true);
    expect(await redo()).toBe(true);
  }, 90000);
});
