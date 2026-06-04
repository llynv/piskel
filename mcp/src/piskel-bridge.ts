import { getSession } from "./browser.js";
import type { Point } from "./geometry.js";

export interface CanvasInfo {
  width: number;
  height: number;
  fps: number;
  name: string;
  layerCount: number;
  frameCount: number;
  currentLayer: number;
  currentFrame: number;
  layers: Array<{ name: string; opacity: number }>;
}

/** Pattern A: apply a list of pixels (one undo step). */
export async function applyPixels(
  pixels: Array<Point & { color: string }>
): Promise<void> {
  const { page } = await getSession();
  await page.evaluate((ps) => window.__piskelMcp.applyPixels(ps), pixels);
}

/** Pattern A: flood fill in-page. */
export async function floodFill(
  x: number,
  y: number,
  color: string
): Promise<void> {
  const { page } = await getSession();
  await page.evaluate((a) => window.__piskelMcp.floodFill(a.x, a.y, a.color), {
    x,
    y,
    color
  });
}

export async function clearArea(area?: {
  x: number;
  y: number;
  w: number;
  h: number;
}): Promise<void> {
  const { page } = await getSession();
  await page.evaluate((a) => window.__piskelMcp.clearArea(a), area ?? null);
}

/** Pattern C: replace whole document with a blank canvas. */
export async function newCanvas(
  width: number,
  height: number,
  name: string,
  fps: number
): Promise<void> {
  const { page } = await getSession();
  await page.evaluate(
    (cfg) => {
      const grid: number[] = new Array(cfg.width * cfg.height).fill(0);
      const frame = window.pskl.model.Frame.fromPixelGrid(
        grid,
        cfg.width,
        cfg.height
      );
      const layer = window.pskl.model.Layer.fromFrames("Layer 1", [frame]);
      const piskel = window.pskl.model.Piskel.fromLayers([layer], cfg.fps, {
        name: cfg.name,
        description: ""
      });
      window.pskl.app.piskelController.setPiskel(piskel);
    },
    { width, height, name, fps }
  );
}

export async function getCanvasInfo(): Promise<CanvasInfo> {
  const { page } = await getSession();
  return page.evaluate(() =>
    window.__piskelMcp.canvasInfo()
  ) as Promise<CanvasInfo>;
}

export async function getPixelInt(
  x: number,
  y: number,
  layer?: number,
  frame?: number
): Promise<number> {
  const { page } = await getSession();
  return page.evaluate(
    (a) =>
      window.__piskelMcp.getPixelHex(
        a.x,
        a.y,
        a.layer ?? null,
        a.frame ?? null
      ),
    { x, y, layer, frame }
  ) as Promise<number>;
}

export async function previewPng(
  scale: number,
  layer?: number,
  frame?: number
): Promise<string> {
  const { page } = await getSession();
  const dataUrl = (await page.evaluate(
    (a) =>
      window.__piskelMcp.previewDataUrl(
        a.scale,
        a.layer ?? null,
        a.frame ?? null
      ),
    { scale, layer, frame }
  )) as string;
  return dataUrl.replace(/^data:image\/png;base64,/, "");
}

/** Render one frame (all layers merged) as a base64 PNG. */
export async function renderPng(
  scale: number,
  frame?: number
): Promise<string> {
  const { page } = await getSession();
  const dataUrl = (await page.evaluate(
    (a) => window.__piskelMcp.exportFramePng(a.scale, a.frame ?? null),
    { scale, frame }
  )) as string;
  return dataUrl.replace(/^data:image\/png;base64,/, "");
}

/** Composite all frames into a sprite-sheet, returned as a base64 PNG. */
export async function renderSpritesheet(
  scale: number,
  columns?: number
): Promise<string> {
  const { page } = await getSession();
  const dataUrl = (await page.evaluate(
    (a) => window.__piskelMcp.exportSpritesheetPng(a.scale, a.columns ?? null),
    { scale, columns }
  )) as string;
  return dataUrl.replace(/^data:image\/png;base64,/, "");
}

/** Encode all frames into an animated GIF, returned as base64 GIF data. */
export async function renderGif(scale: number, fps?: number): Promise<string> {
  const { page } = await getSession();
  const dataUrl = (await page.evaluate(
    (a) => window.__piskelMcp.exportGif(a.scale, a.fps ?? null),
    { scale, fps }
  )) as string;
  return dataUrl.replace(/^data:image\/gif;base64,/, "");
}

export async function getPalette(): Promise<number[]> {
  const { page } = await getSession();
  return page.evaluate(() => window.__piskelMcp.getPalette()) as Promise<
    number[]
  >;
}

export async function setPrimaryColor(hex: string): Promise<boolean> {
  const { page } = await getSession();
  return page.evaluate(
    (h) => window.__piskelMcp.setPrimaryColor(h),
    hex
  ) as Promise<boolean>;
}

export async function serializePiskel(): Promise<string> {
  const { page } = await getSession();
  return page.evaluate(() => window.__piskelMcp.serialize()) as Promise<string>;
}

export async function loadPiskelString(data: string): Promise<void> {
  const { page } = await getSession();
  await page.evaluate((d) => window.__piskelMcp.loadFromString(d), data);
}

/** Pattern B: call a wrapped public controller method by name. */
export async function callController(
  method: string,
  args: unknown[] = []
): Promise<void> {
  const { page } = await getSession();
  await page.evaluate(
    (a) => {
      const fn = (window.pskl.app.piskelController as any)[a.method];
      fn.apply(window.pskl.app.piskelController, a.args);
    },
    { method, args }
  );
}
