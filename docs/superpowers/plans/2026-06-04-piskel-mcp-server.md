# Piskel MCP Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a stdio MCP server (`mcp/`) that drives a live, visible Piskel browser instance via Puppeteer so an agent can draw, adjust, animate, and export pixel-art assets while the user watches.

**Architecture:** Node/TypeScript MCP server. Pure-Node modules (color, geometry, schemas) are unit-tested. A Puppeteer bridge runs `page.evaluate()` against `window.pskl` — the same surface the Playwright e2e tests already use. Three commit patterns: direct `Frame.setPixel` + `PISKEL_SAVE_STATE` (pixels), wrapped `piskelController` methods (structure), and `setPiskel` (whole-document). The live browser document is the single source of truth.

**Tech Stack:** TypeScript, `@modelcontextprotocol/sdk` (stdio), `zod`, `puppeteer` (already a dependency), Node `child_process`/`fetch` to run and probe the repo's `scripts/serve.js`.

**Reference facts (verified):**
- Server: `node scripts/serve.js --test` → `http://localhost:9001/`, editor at `/`, no watch/live-reload (`scripts/serve.js:20-21`, `constants.ts:1`).
- Readiness: `#drawing-canvas-container canvas` attached (`testutils.ts:21-24`).
- Live API: `window.pskl.app.piskelController`, `.getCurrentFrame()`, `.getPiskel()`, `.setPiskel()`; `window.pskl.utils.colorToInt`; `window.pskl.model.*`; `window.Events.PISKEL_SAVE_STATE`; `window.pskl.service.HistoryService.SNAPSHOT`; jQuery pub/sub via `window.jQuery.publish` (aliased `$`).
- Color int: `(a<<24)>>>0)+(b<<16)+(g<<8)+r`; transparent = `0` (`testutils.ts:345-356`).
- Wrapped structural methods fire redraw+history (`PublicPiskelController.js:15-59`).

**Milestones (each independently runnable & testable):**
- **M1 Foundation** — scaffold, color, geometry, schemas, MCP skeleton, browser lifecycle, bridge core, and tools `new_canvas`, `set_pixel`, `set_pixels`, `get_canvas_info`, `get_canvas_preview`, `shutdown`.
- **M2 Drawing & reads** — `draw_line`, `draw_rect`, `fill_rect`, `draw_ellipse`, `flood_fill`, `clear`, `get_pixel`, `get_grid`.
- **M3 Structure** — frames, layers, fps, color helpers.
- **M4 Persistence & export** — save/load `.piskel`, export PNG/spritesheet/GIF, undo/redo.

**Refinement vs spec:** line/rect/ellipse pixel sets are computed by **pure Node functions** (unit-testable) and applied via a single in-page batch applier; only `flood_fill` runs in-page (it needs to read current pixels). This stays within the spec's three commit patterns.

---

## Milestone 1 — Foundation

### Task 1: Scaffold the `mcp/` package

**Files:**
- Create: `mcp/package.json`
- Create: `mcp/tsconfig.json`
- Create: `mcp/.gitignore`
- Create: `mcp/vitest.config.ts`

- [ ] **Step 1: Create `mcp/package.json`**

```json
{
  "name": "piskel-mcp",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "bin": { "piskel-mcp": "./dist/server.js" },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "dev": "tsc -p tsconfig.json --watch",
    "start": "node dist/server.js",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "puppeteer": "24.40.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "typescript": "5.9.3",
    "vitest": "^2.0.0",
    "@types/node": "^20.0.0"
  }
}
```

- [ ] **Step 2: Create `mcp/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "declaration": false,
    "sourceMap": true
  },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 3: Create `mcp/.gitignore`**

```
node_modules/
dist/
```

- [ ] **Step 4: Create `mcp/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node"
  }
});
```

- [ ] **Step 5: Install and verify**

Run: `cd mcp && npm install`
Expected: dependencies install with no errors.

- [ ] **Step 6: Commit**

```bash
git add mcp/package.json mcp/tsconfig.json mcp/.gitignore mcp/vitest.config.ts mcp/package-lock.json
git commit -m "chore(mcp): scaffold piskel-mcp package"
```

---

### Task 2: Color conversion module

**Files:**
- Create: `mcp/src/color.ts`
- Test: `mcp/src/color.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { hexToInt, normalizeHex, isValidColor } from "./color.js";

describe("color", () => {
  it("converts opaque hex to Piskel ABGR int", () => {
    // #FF0000 → a=255,b=0,g=0,r=255
    expect(hexToInt("#FF0000")).toBe(((255 << 24) >>> 0) + 255);
  });
  it("treats transparent as 0", () => {
    expect(hexToInt("transparent")).toBe(0);
    expect(hexToInt("#00000000")).toBe(0);
  });
  it("supports #RRGGBBAA", () => {
    expect(hexToInt("#0000FF80")).toBe(((0x80 << 24) >>> 0) + (255 << 16));
  });
  it("normalizes shorthand and case", () => {
    expect(normalizeHex("#abc")).toBe("#AABBCC");
  });
  it("validates color strings", () => {
    expect(isValidColor("#FFF")).toBe(true);
    expect(isValidColor("transparent")).toBe(true);
    expect(isValidColor("red")).toBe(false);
    expect(isValidColor("#GGGGGG")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd mcp && npx vitest run src/color.test.ts`
Expected: FAIL — module `./color.js` not found.

- [ ] **Step 3: Write the implementation**

```ts
// mcp/src/color.ts
const HEX3 = /^#?([0-9a-fA-F]{3})$/;
const HEX6 = /^#?([0-9a-fA-F]{6})$/;
const HEX8 = /^#?([0-9a-fA-F]{8})$/;

export function isValidColor(input: string): boolean {
  if (input === "transparent" || input === "0") return true;
  return HEX3.test(input) || HEX6.test(input) || HEX8.test(input);
}

export function normalizeHex(input: string): string {
  if (input === "transparent" || input === "0") return "transparent";
  let h = input.replace("#", "");
  if (h.length === 3) {
    h = h.split("").map((c) => c + c).join("");
  }
  return "#" + h.toUpperCase();
}

export function hexToInt(input: string): number {
  if (input === "transparent" || input === "0") return 0;
  let h = input.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  const a = h.length >= 8 ? parseInt(h.substring(6, 8), 16) : 255;
  if (a === 0) return 0;
  return ((a << 24) >>> 0) + (b << 16) + (g << 8) + r;
}

export function intToHex(value: number): string {
  if (value === 0) return "transparent";
  const r = value & 0xff;
  const g = (value >> 8) & 0xff;
  const b = (value >> 16) & 0xff;
  const a = (value >>> 24) & 0xff;
  const hx = (n: number) => n.toString(16).padStart(2, "0").toUpperCase();
  return a === 255 ? `#${hx(r)}${hx(g)}${hx(b)}` : `#${hx(r)}${hx(g)}${hx(b)}${hx(a)}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd mcp && npx vitest run src/color.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add mcp/src/color.ts mcp/src/color.test.ts
git commit -m "feat(mcp): add color hex<->ABGR conversion"
```

---

### Task 3: Pixel-space geometry module

**Files:**
- Create: `mcp/src/geometry.ts`
- Test: `mcp/src/geometry.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { line, rect, ellipse } from "./geometry.js";

const sort = (ps: Array<{ x: number; y: number }>) =>
  [...ps].sort((a, b) => a.y - b.y || a.x - b.x);

describe("geometry", () => {
  it("draws a horizontal line", () => {
    expect(sort(line(0, 0, 2, 0))).toEqual([
      { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }
    ]);
  });
  it("draws a diagonal line", () => {
    expect(sort(line(0, 0, 2, 2))).toEqual([
      { x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }
    ]);
  });
  it("draws a rect outline", () => {
    const pts = sort(rect(0, 0, 3, 3, false));
    expect(pts).toContainEqual({ x: 0, y: 0 });
    expect(pts).toContainEqual({ x: 2, y: 2 });
    expect(pts).not.toContainEqual({ x: 1, y: 1 }); // hollow center
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd mcp && npx vitest run src/geometry.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
// mcp/src/geometry.ts
export interface Point { x: number; y: number; }

export function line(x0: number, y0: number, x1: number, y1: number): Point[] {
  const pts: Point[] = [];
  let dx = Math.abs(x1 - x0);
  let dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  let x = x0;
  let y = y0;
  while (true) {
    pts.push({ x, y });
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx) { err += dx; y += sy; }
  }
  return pts;
}

export function rect(x: number, y: number, w: number, h: number, fill: boolean): Point[] {
  const pts: Point[] = [];
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const edge = i === 0 || j === 0 || i === w - 1 || j === h - 1;
      if (fill || edge) pts.push({ x: x + i, y: y + j });
    }
  }
  return pts;
}

export function ellipse(x: number, y: number, w: number, h: number, fill: boolean): Point[] {
  const set = new Set<string>();
  const cx = x + (w - 1) / 2;
  const cy = y + (h - 1) / 2;
  const rx = w / 2;
  const ry = h / 2;
  const add = (px: number, py: number) => set.add(`${Math.round(px)},${Math.round(py)}`);
  // Parametric sampling, dense enough for pixel grids.
  const steps = Math.max(8, Math.ceil((rx + ry) * 4));
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    add(cx + Math.cos(t) * (rx - 0.5), cy + Math.sin(t) * (ry - 0.5));
  }
  if (fill) {
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const nx = (x + i - cx) / (rx - 0.5 || 0.5);
        const ny = (y + j - cy) / (ry - 0.5 || 0.5);
        if (nx * nx + ny * ny <= 1) set.add(`${x + i},${y + j}`);
      }
    }
  }
  return [...set].map((s) => {
    const [px, py] = s.split(",").map(Number);
    return { x: px, y: py };
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd mcp && npx vitest run src/geometry.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add mcp/src/geometry.ts mcp/src/geometry.test.ts
git commit -m "feat(mcp): add pixel-space geometry (line/rect/ellipse)"
```

---

### Task 4: zod schemas

**Files:**
- Create: `mcp/src/schemas.ts`
- Test: `mcp/src/schemas.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { ColorSchema, SetPixelSchema, NewCanvasSchema } from "./schemas.js";

describe("schemas", () => {
  it("accepts valid colors", () => {
    expect(ColorSchema.parse("#FF0000")).toBe("#FF0000");
    expect(ColorSchema.parse("transparent")).toBe("transparent");
  });
  it("rejects invalid colors", () => {
    expect(() => ColorSchema.parse("red")).toThrow();
  });
  it("validates set_pixel args", () => {
    expect(SetPixelSchema.parse({ x: 1, y: 2, color: "#000000" })).toEqual({
      x: 1, y: 2, color: "#000000"
    });
    expect(() => SetPixelSchema.parse({ x: -1, y: 0, color: "#000" })).toThrow();
  });
  it("validates new_canvas args with defaults", () => {
    const v = NewCanvasSchema.parse({ width: 16, height: 16 });
    expect(v.fps).toBe(12);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd mcp && npx vitest run src/schemas.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
// mcp/src/schemas.ts
import { z } from "zod";
import { isValidColor } from "./color.js";

export const ColorSchema = z.string().refine(isValidColor, {
  message: "Color must be #RGB, #RRGGBB, #RRGGBBAA, or 'transparent'"
});

const Coord = z.number().int().min(0);
const Dim = z.number().int().min(1);

export const NewCanvasSchema = z.object({
  width: Dim,
  height: Dim,
  name: z.string().optional(),
  fps: z.number().int().min(1).max(60).default(12)
});

export const SetPixelSchema = z.object({ x: Coord, y: Coord, color: ColorSchema });

export const SetPixelsSchema = z.object({
  pixels: z.array(z.object({ x: Coord, y: Coord, color: ColorSchema })).min(1)
});

export const LineSchema = z.object({
  x1: Coord, y1: Coord, x2: Coord, y2: Coord, color: ColorSchema
});

export const RectSchema = z.object({
  x: Coord, y: Coord, w: Dim, h: Dim, color: ColorSchema, fill: z.boolean().default(false)
});

export const EllipseSchema = RectSchema;

export const FloodFillSchema = z.object({ x: Coord, y: Coord, color: ColorSchema });

export const PreviewSchema = z.object({
  scale: z.number().int().min(1).max(32).default(8),
  frame: z.number().int().min(0).optional(),
  layer: z.number().int().min(0).optional()
});

export const GetPixelSchema = z.object({
  x: Coord, y: Coord,
  layer: z.number().int().min(0).optional(),
  frame: z.number().int().min(0).optional()
});

export const PathSchema = z.object({ path: z.string().min(1) });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd mcp && npx vitest run src/schemas.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add mcp/src/schemas.ts mcp/src/schemas.test.ts
git commit -m "feat(mcp): add zod schemas for tool args"
```

---

### Task 5: In-page helper script

**Files:**
- Create: `mcp/injected/piskel-helper.js`

This script is injected once per page load. It exposes `window.__piskelMcp` used by the bridge. No unit test (browser-dependent); covered by Task 8 integration test.

- [ ] **Step 1: Create the helper**

```js
// mcp/injected/piskel-helper.js
(function () {
  function pc() { return window.pskl.app.piskelController; }
  function $pub(type) {
    window.jQuery.publish(window.Events.PISKEL_SAVE_STATE, {
      type: window.pskl.service.HistoryService.SNAPSHOT
    });
  }

  window.__piskelMcp = {
    // Apply a batch of {x,y,color} (color = hex string) to current frame, one undo step.
    applyPixels: function (pixels) {
      var frame = pc().getCurrentFrame();
      for (var i = 0; i < pixels.length; i++) {
        var p = pixels[i];
        frame.setPixel(p.x, p.y, window.pskl.utils.colorToInt(p.color));
      }
      $pub();
      return true;
    },

    floodFill: function (x, y, color) {
      var frame = pc().getCurrentFrame();
      var w = frame.getWidth(), h = frame.getHeight();
      if (x < 0 || y < 0 || x >= w || y >= h) return false;
      var target = frame.getPixel(x, y);
      var replacement = window.pskl.utils.colorToInt(color);
      if (target === replacement) return true;
      var stack = [[x, y]];
      while (stack.length) {
        var c = stack.pop();
        var cx = c[0], cy = c[1];
        if (cx < 0 || cy < 0 || cx >= w || cy >= h) continue;
        if (frame.getPixel(cx, cy) !== target) continue;
        frame.setPixel(cx, cy, replacement);
        stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
      }
      $pub();
      return true;
    },

    clearArea: function (area) {
      var frame = pc().getCurrentFrame();
      if (!area) {
        frame.clear();
      } else {
        var t = window.pskl.utils.colorToInt("rgba(0,0,0,0)");
        for (var j = 0; j < area.h; j++)
          for (var i = 0; i < area.w; i++)
            frame.setPixel(area.x + i, area.y + j, t);
      }
      $pub();
      return true;
    },

    canvasInfo: function () {
      var piskel = pc().getPiskel();
      var layers = piskel.getLayers().map(function (l) {
        return { name: l.getName(), opacity: l.getOpacity() };
      });
      return {
        width: piskel.getWidth(),
        height: piskel.getHeight(),
        fps: pc().getFPS(),
        name: piskel.getDescriptor().name,
        layerCount: piskel.getLayers().length,
        frameCount: pc().getFrameCount(),
        currentLayer: pc().currentLayerIndex,
        currentFrame: pc().currentFrameIndex,
        layers: layers
      };
    },

    getPixelHex: function (x, y, layerIndex, frameIndex) {
      var piskel = pc().getPiskel();
      var li = layerIndex == null ? pc().currentLayerIndex : layerIndex;
      var fi = frameIndex == null ? pc().currentFrameIndex : frameIndex;
      var frame = piskel.getLayerAt(li).getFrameAt(fi);
      return frame.getPixel(x, y);
    },

    // Returns a scaled PNG dataURL of one frame (flattened single layer).
    previewDataUrl: function (scale, layerIndex, frameIndex) {
      var piskel = pc().getPiskel();
      var li = layerIndex == null ? pc().currentLayerIndex : layerIndex;
      var fi = frameIndex == null ? pc().currentFrameIndex : frameIndex;
      var frame = piskel.getLayerAt(li).getFrameAt(fi);
      var renderer = new window.pskl.rendering.frame.CanvasRenderer(frame, scale);
      return renderer.render().toDataURL();
    }
  };
})();
```

- [ ] **Step 2: Commit**

```bash
git add mcp/injected/piskel-helper.js
git commit -m "feat(mcp): add in-page __piskelMcp helper"
```

> Note for implementer: confirm `pskl.rendering.frame.CanvasRenderer(frame, zoom)` exists by grepping `src/js/rendering` during Task 8; if the constructor differs, adjust `previewDataUrl` to the actual renderer (e.g. `FrameRenderer`). The bridge integration test in Task 8 will catch a wrong constructor.

---

### Task 6: Browser lifecycle module

**Files:**
- Create: `mcp/src/browser.ts`

Browser-dependent; verified via Task 8 integration test. No standalone unit test.

- [ ] **Step 1: Write the implementation**

```ts
// mcp/src/browser.ts
import { spawn, ChildProcess } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer, { Browser, Page } from "puppeteer";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..");
const PORT = Number(process.env.PISKEL_MCP_PORT ?? 9001);
const URL = process.env.PISKEL_MCP_URL ?? `http://localhost:${PORT}/`;
const HEADLESS = process.env.PISKEL_MCP_HEADLESS === "true";
const HELPER = resolve(__dirname, "..", "injected", "piskel-helper.js");

export interface PiskelSession { browser: Browser; page: Page; }

let session: PiskelSession | null = null;
let serverProc: ChildProcess | null = null;

function assertBuildExists(): void {
  const indexPath = resolve(REPO_ROOT, "dest", "prod", "index.html");
  if (!existsSync(indexPath)) {
    throw new Error(
      "Piskel production build not found at dest/prod. Run `npm run build` in the repo root first."
    );
  }
}

async function waitForServer(timeoutMs = 15000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(URL);
      if (res.ok) return;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Piskel server did not respond at ${URL} within ${timeoutMs}ms`);
}

async function ensureServer(): Promise<void> {
  // If an external URL is configured, assume it is already served.
  if (process.env.PISKEL_MCP_URL) {
    await waitForServer();
    return;
  }
  try {
    const res = await fetch(URL);
    if (res.ok) return; // already running
  } catch { /* start it */ }

  assertBuildExists();
  serverProc = spawn("node", ["scripts/serve.js", "--test"], {
    cwd: REPO_ROOT,
    stdio: "ignore",
    detached: false
  });
  await waitForServer();
}

export async function getSession(): Promise<PiskelSession> {
  if (session && !session.page.isClosed()) return session;

  await ensureServer();
  const browser = await puppeteer.launch({
    headless: HEADLESS,
    defaultViewport: null,
    args: ["--window-size=1200,800"]
  });
  const page = (await browser.pages())[0] ?? (await browser.newPage());
  const helperSource = readFileSync(HELPER, "utf-8");
  await page.evaluateOnNewDocument(helperSource);
  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#drawing-canvas-container canvas", { timeout: 20000 });
  // Ensure helper is present even if injected before pskl was ready.
  await page.evaluate(helperSource);

  session = { browser, page };
  return session;
}

export async function shutdown(): Promise<void> {
  if (session) {
    try { await session.browser.close(); } catch { /* ignore */ }
    session = null;
  }
  if (serverProc && !serverProc.killed) {
    serverProc.kill();
    serverProc = null;
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `cd mcp && npx tsc -p tsconfig.json --noEmit`
Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add mcp/src/browser.ts
git commit -m "feat(mcp): add browser lifecycle (serve + launch + readiness)"
```

---

### Task 7: Bridge core

**Files:**
- Create: `mcp/src/piskel-bridge.ts`

- [ ] **Step 1: Write the implementation**

```ts
// mcp/src/piskel-bridge.ts
import { getSession } from "./browser.js";
import type { Point } from "./geometry.js";

export interface CanvasInfo {
  width: number; height: number; fps: number; name: string;
  layerCount: number; frameCount: number;
  currentLayer: number; currentFrame: number;
  layers: Array<{ name: string; opacity: number }>;
}

/** Pattern A: apply a list of pixels (one undo step). */
export async function applyPixels(pixels: Array<Point & { color: string }>): Promise<void> {
  const { page } = await getSession();
  await page.evaluate((ps) => window.__piskelMcp.applyPixels(ps), pixels);
}

/** Pattern A: flood fill in-page. */
export async function floodFill(x: number, y: number, color: string): Promise<void> {
  const { page } = await getSession();
  await page.evaluate((a) => window.__piskelMcp.floodFill(a.x, a.y, a.color), { x, y, color });
}

export async function clearArea(area?: { x: number; y: number; w: number; h: number }): Promise<void> {
  const { page } = await getSession();
  await page.evaluate((a) => window.__piskelMcp.clearArea(a), area ?? null);
}

/** Pattern C: replace whole document with a blank canvas. */
export async function newCanvas(width: number, height: number, name: string, fps: number): Promise<void> {
  const { page } = await getSession();
  await page.evaluate((cfg) => {
    const grid: number[] = new Array(cfg.width * cfg.height).fill(0);
    const frame = window.pskl.model.Frame.fromPixelGrid(grid, cfg.width, cfg.height);
    const layer = window.pskl.model.Layer.fromFrames("Layer 1", [frame]);
    const piskel = window.pskl.model.Piskel.fromLayers([layer], cfg.fps, {
      name: cfg.name, description: ""
    });
    window.pskl.app.piskelController.setPiskel(piskel);
  }, { width, height, name, fps });
}

export async function getCanvasInfo(): Promise<CanvasInfo> {
  const { page } = await getSession();
  return page.evaluate(() => window.__piskelMcp.canvasInfo()) as Promise<CanvasInfo>;
}

export async function getPixelInt(x: number, y: number, layer?: number, frame?: number): Promise<number> {
  const { page } = await getSession();
  return page.evaluate(
    (a) => window.__piskelMcp.getPixelHex(a.x, a.y, a.layer ?? null, a.frame ?? null),
    { x, y, layer, frame }
  ) as Promise<number>;
}

export async function previewPng(scale: number, layer?: number, frame?: number): Promise<string> {
  const { page } = await getSession();
  const dataUrl = (await page.evaluate(
    (a) => window.__piskelMcp.previewDataUrl(a.scale, a.layer ?? null, a.frame ?? null),
    { scale, layer, frame }
  )) as string;
  return dataUrl.replace(/^data:image\/png;base64,/, "");
}

/** Pattern B: call a wrapped public controller method by name. */
export async function callController(method: string, args: unknown[] = []): Promise<void> {
  const { page } = await getSession();
  await page.evaluate(
    (a) => {
      const fn = (window.pskl.app.piskelController as any)[a.method];
      fn.apply(window.pskl.app.piskelController, a.args);
    },
    { method, args }
  );
}
```

- [ ] **Step 2: Add the `window.pskl` ambient type**

Create: `mcp/src/global.d.ts`

```ts
export {};
declare global {
  interface Window {
    pskl: any;
    Events: any;
    jQuery: any;
    __piskelMcp: {
      applyPixels: (pixels: Array<{ x: number; y: number; color: string }>) => boolean;
      floodFill: (x: number, y: number, color: string) => boolean;
      clearArea: (area: { x: number; y: number; w: number; h: number } | null) => boolean;
      canvasInfo: () => any;
      getPixelHex: (x: number, y: number, layer: number | null, frame: number | null) => number;
      previewDataUrl: (scale: number, layer: number | null, frame: number | null) => string;
    };
  }
}
```

- [ ] **Step 3: Typecheck**

Run: `cd mcp && npx tsc -p tsconfig.json --noEmit`
Expected: no type errors.

- [ ] **Step 4: Commit**

```bash
git add mcp/src/piskel-bridge.ts mcp/src/global.d.ts
git commit -m "feat(mcp): add Puppeteer bridge core (3 commit patterns)"
```

---

### Task 8: Bridge integration test (live browser)

**Files:**
- Create: `mcp/src/bridge.integration.test.ts`

This test requires `dest/prod` to exist. It launches the real browser.

- [ ] **Step 1: Write the test**

```ts
import { describe, it, expect, afterAll } from "vitest";
import { newCanvas, applyPixels, getPixelInt, getCanvasInfo } from "./piskel-bridge.js";
import { shutdown } from "./browser.js";
import { hexToInt } from "./color.js";

describe("bridge integration", () => {
  afterAll(async () => { await shutdown(); });

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
```

- [ ] **Step 2: Ensure the build exists, then run**

Run: `npm run build` (repo root) — only if `dest/prod` is missing.
Run: `cd mcp && npx vitest run src/bridge.integration.test.ts`
Expected: PASS. A visible Chromium opens, draws one red pixel at (1,1), closes.

If `previewDataUrl`'s renderer constructor was wrong, fix `injected/piskel-helper.js` now (grep `src/js/rendering/frame` for the real class) and re-run.

- [ ] **Step 3: Commit**

```bash
git add mcp/src/bridge.integration.test.ts
git commit -m "test(mcp): add live-browser bridge integration test"
```

---

### Task 9: MCP server skeleton + M1 tools

**Files:**
- Create: `mcp/src/server.ts`
- Create: `mcp/src/tools/canvas.ts`
- Create: `mcp/src/tools/session.ts`

- [ ] **Step 1: Create `mcp/src/tools/canvas.ts`**

```ts
// mcp/src/tools/canvas.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { NewCanvasSchema, SetPixelSchema, SetPixelsSchema, PreviewSchema } from "../schemas.js";
import * as bridge from "../piskel-bridge.js";

export function registerCanvasTools(server: McpServer): void {
  server.registerTool(
    "new_canvas",
    {
      description: "Create a new blank canvas, replacing the current document. Subsequent drawing targets it.",
      inputSchema: NewCanvasSchema.shape
    },
    async (args) => {
      const a = NewCanvasSchema.parse(args);
      await bridge.newCanvas(a.width, a.height, a.name ?? "sprite", a.fps);
      const info = await bridge.getCanvasInfo();
      return { content: [{ type: "text", text: JSON.stringify(info) }] };
    }
  );

  server.registerTool(
    "get_canvas_info",
    { description: "Return current canvas dimensions, fps, layers, frames, and selection.", inputSchema: {} },
    async () => {
      const info = await bridge.getCanvasInfo();
      return { content: [{ type: "text", text: JSON.stringify(info) }] };
    }
  );

  server.registerTool(
    "set_pixel",
    { description: "Set a single pixel (x,y) to a color on the current layer+frame.", inputSchema: SetPixelSchema.shape },
    async (args) => {
      const a = SetPixelSchema.parse(args);
      await bridge.applyPixels([{ x: a.x, y: a.y, color: a.color }]);
      return { content: [{ type: "text", text: `Set pixel (${a.x},${a.y}) = ${a.color}` }] };
    }
  );

  server.registerTool(
    "set_pixels",
    { description: "Set many pixels in one undo step. Efficient for whole sprites.", inputSchema: SetPixelsSchema.shape },
    async (args) => {
      const a = SetPixelsSchema.parse(args);
      await bridge.applyPixels(a.pixels);
      return { content: [{ type: "text", text: `Set ${a.pixels.length} pixels` }] };
    }
  );

  server.registerTool(
    "get_canvas_preview",
    { description: "Return a scaled PNG of a frame so you can see your work.", inputSchema: PreviewSchema.shape },
    async (args) => {
      const a = PreviewSchema.parse(args);
      const b64 = await bridge.previewPng(a.scale, a.layer, a.frame);
      return { content: [{ type: "image", data: b64, mimeType: "image/png" }] };
    }
  );
}
```

- [ ] **Step 2: Create `mcp/src/tools/session.ts`**

```ts
// mcp/src/tools/session.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { shutdown } from "../browser.js";

export function registerSessionTools(server: McpServer): void {
  server.registerTool(
    "shutdown",
    { description: "Close the Piskel browser and local server. Use only when fully done.", inputSchema: {} },
    async () => {
      await shutdown();
      return { content: [{ type: "text", text: "Piskel session closed." }] };
    }
  );
}
```

- [ ] **Step 3: Create `mcp/src/server.ts`**

```ts
// mcp/src/server.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerCanvasTools } from "./tools/canvas.js";
import { registerSessionTools } from "./tools/session.js";
import { shutdown } from "./browser.js";

async function main(): Promise<void> {
  const server = new McpServer({ name: "piskel-mcp", version: "0.1.0" });

  registerCanvasTools(server);
  registerSessionTools(server);

  const cleanup = async () => { await shutdown(); process.exit(0); };
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 4: Build and verify it boots**

Run: `cd mcp && npm run build && node dist/server.js`
Expected: process starts and waits on stdio (no crash). Stop with Ctrl-C.

- [ ] **Step 5: Commit**

```bash
git add mcp/src/server.ts mcp/src/tools/canvas.ts mcp/src/tools/session.ts
git commit -m "feat(mcp): MCP server skeleton + M1 canvas tools"
```

---

### Task 10: M1 README and manual smoke

**Files:**
- Create: `mcp/README.md`

- [ ] **Step 1: Write `mcp/README.md`**

````markdown
# piskel-mcp

An MCP server that drives a live Piskel browser window so an agent can draw, animate, and export pixel art while you watch.

## Prerequisites
- Build the app once from the repo root: `npm run build`
- Build the server: `cd mcp && npm install && npm run build`

## Run / connect
Add to your agent's MCP config:
```json
{
  "mcpServers": {
    "piskel": { "command": "node", "args": ["<repo>/mcp/dist/server.js"] }
  }
}
```
On the first tool call, a Chromium window opens with Piskel loaded. It stays open for the whole session.

## Config (env)
- `PISKEL_MCP_URL` — target URL (default `http://localhost:9001/`)
- `PISKEL_MCP_PORT` — serve port (default `9001`)
- `PISKEL_MCP_HEADLESS` — `true` to hide the browser (default `false`)
- `PISKEL_MCP_EXPORT_DIR` — default dir for relative export paths

## Tools
See the design spec at `docs/superpowers/specs/2026-06-04-piskel-mcp-server-design.md` for the full catalog. Tool reference is expanded as milestones land.
````

- [ ] **Step 2: Commit**

```bash
git add mcp/README.md
git commit -m "docs(mcp): add README with setup and config"
```

---

## Milestone 2 — Drawing & reads

### Task 11: Drawing tools (line/rect/fill_rect/ellipse/flood_fill/clear)

**Files:**
- Create: `mcp/src/tools/drawing.ts`
- Modify: `mcp/src/server.ts` (register)

- [ ] **Step 1: Create `mcp/src/tools/drawing.ts`**

```ts
// mcp/src/tools/drawing.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LineSchema, RectSchema, EllipseSchema, FloodFillSchema } from "../schemas.js";
import { z } from "zod";
import { line, rect, ellipse } from "../geometry.js";
import * as bridge from "../piskel-bridge.js";

const ClearSchema = z.object({
  area: z.object({ x: z.number().int().min(0), y: z.number().int().min(0),
    w: z.number().int().min(1), h: z.number().int().min(1) }).optional()
});

export function registerDrawingTools(server: McpServer): void {
  server.registerTool(
    "draw_line",
    { description: "Draw a line from (x1,y1) to (x2,y2).", inputSchema: LineSchema.shape },
    async (args) => {
      const a = LineSchema.parse(args);
      const pts = line(a.x1, a.y1, a.x2, a.y2).map((p) => ({ ...p, color: a.color }));
      await bridge.applyPixels(pts);
      return { content: [{ type: "text", text: `Line drawn (${pts.length} px)` }] };
    }
  );

  server.registerTool(
    "draw_rect",
    { description: "Draw a rectangle outline or filled (fill=true).", inputSchema: RectSchema.shape },
    async (args) => {
      const a = RectSchema.parse(args);
      const pts = rect(a.x, a.y, a.w, a.h, a.fill).map((p) => ({ ...p, color: a.color }));
      await bridge.applyPixels(pts);
      return { content: [{ type: "text", text: `Rect drawn (${pts.length} px)` }] };
    }
  );

  server.registerTool(
    "fill_rect",
    { description: "Draw a filled rectangle.", inputSchema: RectSchema.shape },
    async (args) => {
      const a = RectSchema.parse(args);
      const pts = rect(a.x, a.y, a.w, a.h, true).map((p) => ({ ...p, color: a.color }));
      await bridge.applyPixels(pts);
      return { content: [{ type: "text", text: `Filled rect (${pts.length} px)` }] };
    }
  );

  server.registerTool(
    "draw_ellipse",
    { description: "Draw an ellipse outline or filled within the bounding box (x,y,w,h).", inputSchema: EllipseSchema.shape },
    async (args) => {
      const a = EllipseSchema.parse(args);
      const pts = ellipse(a.x, a.y, a.w, a.h, a.fill).map((p) => ({ ...p, color: a.color }));
      await bridge.applyPixels(pts);
      return { content: [{ type: "text", text: `Ellipse drawn (${pts.length} px)` }] };
    }
  );

  server.registerTool(
    "flood_fill",
    { description: "Paint-bucket fill starting from (x,y).", inputSchema: FloodFillSchema.shape },
    async (args) => {
      const a = FloodFillSchema.parse(args);
      await bridge.floodFill(a.x, a.y, a.color);
      return { content: [{ type: "text", text: `Flood fill from (${a.x},${a.y})` }] };
    }
  );

  server.registerTool(
    "clear",
    { description: "Clear the whole current frame, or an optional rectangular area.", inputSchema: ClearSchema.shape },
    async (args) => {
      const a = ClearSchema.parse(args);
      await bridge.clearArea(a.area);
      return { content: [{ type: "text", text: a.area ? "Area cleared" : "Frame cleared" }] };
    }
  );
}
```

- [ ] **Step 2: Register in `mcp/src/server.ts`**

Add the import and call (place after `registerCanvasTools(server);`):

```ts
import { registerDrawingTools } from "./tools/drawing.js";
// ...
registerDrawingTools(server);
```

- [ ] **Step 3: Build + typecheck**

Run: `cd mcp && npm run build`
Expected: compiles clean.

- [ ] **Step 4: Commit**

```bash
git add mcp/src/tools/drawing.ts mcp/src/server.ts
git commit -m "feat(mcp): add drawing tools (line/rect/ellipse/fill/clear)"
```

---

### Task 12: Read tools (get_pixel/get_grid) + integration test

**Files:**
- Create: `mcp/src/tools/reads.ts`
- Modify: `mcp/src/server.ts`
- Create: `mcp/src/drawing.integration.test.ts`

- [ ] **Step 1: Create `mcp/src/tools/reads.ts`**

```ts
// mcp/src/tools/reads.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { GetPixelSchema } from "../schemas.js";
import { z } from "zod";
import * as bridge from "../piskel-bridge.js";
import { intToHex } from "../color.js";

const GridSchema = z.object({
  layer: z.number().int().min(0).optional(),
  frame: z.number().int().min(0).optional()
});

export function registerReadTools(server: McpServer): void {
  server.registerTool(
    "get_pixel",
    { description: "Get the hex color at (x,y).", inputSchema: GetPixelSchema.shape },
    async (args) => {
      const a = GetPixelSchema.parse(args);
      const value = await bridge.getPixelInt(a.x, a.y, a.layer, a.frame);
      return { content: [{ type: "text", text: intToHex(value) }] };
    }
  );

  server.registerTool(
    "get_grid",
    { description: "Return the frame as a 2D grid of hex colors (best for small canvases).", inputSchema: GridSchema.shape },
    async (args) => {
      const a = GridSchema.parse(args);
      const info = await bridge.getCanvasInfo();
      const grid: string[][] = [];
      for (let y = 0; y < info.height; y++) {
        const row: string[] = [];
        for (let x = 0; x < info.width; x++) {
          row.push(intToHex(await bridge.getPixelInt(x, y, a.layer, a.frame)));
        }
        grid.push(row);
      }
      return { content: [{ type: "text", text: JSON.stringify(grid) }] };
    }
  );
}
```

> Note: `get_grid` does width×height bridge round-trips. Acceptable for small sprites. If this proves slow for larger canvases during testing, add a `__piskelMcp.getGrid()` helper that returns the whole grid in one `page.evaluate` and switch to it. Defer unless needed (YAGNI).

- [ ] **Step 2: Register in `mcp/src/server.ts`**

```ts
import { registerReadTools } from "./tools/reads.js";
// ...
registerReadTools(server);
```

- [ ] **Step 3: Write drawing integration test**

```ts
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
```

- [ ] **Step 4: Run integration tests**

Run: `cd mcp && npx vitest run src/drawing.integration.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add mcp/src/tools/reads.ts mcp/src/server.ts mcp/src/drawing.integration.test.ts
git commit -m "feat(mcp): add read tools + drawing integration tests"
```

---

## Milestone 3 — Structure (frames, layers, fps, color)

### Task 13: Frame tools

**Files:**
- Create: `mcp/src/tools/frames.ts`
- Modify: `mcp/src/server.ts`

- [ ] **Step 1: Create `mcp/src/tools/frames.ts`**

```ts
// mcp/src/tools/frames.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as bridge from "../piskel-bridge.js";

export function registerFrameTools(server: McpServer): void {
  server.registerTool(
    "add_frame",
    { description: "Add a new frame. duplicateCurrent=true copies the current frame.",
      inputSchema: { duplicateCurrent: z.boolean().default(false) } },
    async (args) => {
      const dup = z.boolean().default(false).parse(args?.duplicateCurrent);
      await bridge.callController(dup ? "duplicateCurrentFrame" : "addFrameAtCurrentIndex");
      const info = await bridge.getCanvasInfo();
      return { content: [{ type: "text", text: `Frames: ${info.frameCount}` }] };
    }
  );

  server.registerTool(
    "duplicate_frame",
    { description: "Duplicate a frame by index (defaults to current).",
      inputSchema: { index: z.number().int().min(0).optional() } },
    async (args) => {
      const info = await bridge.getCanvasInfo();
      const idx = (args?.index as number) ?? info.currentFrame;
      await bridge.callController("duplicateFrameAt", [idx]);
      return { content: [{ type: "text", text: `Duplicated frame ${idx}` }] };
    }
  );

  server.registerTool(
    "remove_frame",
    { description: "Remove a frame by index. Refuses to remove the last frame.",
      inputSchema: { index: z.number().int().min(0) } },
    async (args) => {
      const idx = z.number().int().min(0).parse(args?.index);
      const info = await bridge.getCanvasInfo();
      if (info.frameCount <= 1) {
        return { content: [{ type: "text", text: "Cannot remove the last frame." }], isError: true };
      }
      await bridge.callController("removeFrameAt", [idx]);
      return { content: [{ type: "text", text: `Removed frame ${idx}` }] };
    }
  );

  server.registerTool(
    "select_frame",
    { description: "Select the current frame; subsequent drawing targets it.",
      inputSchema: { index: z.number().int().min(0) } },
    async (args) => {
      const idx = z.number().int().min(0).parse(args?.index);
      await bridge.callController("setCurrentFrameIndex", [idx]);
      return { content: [{ type: "text", text: `Selected frame ${idx}` }] };
    }
  );

  server.registerTool(
    "move_frame",
    { description: "Reorder a frame from one index to another.",
      inputSchema: { from: z.number().int().min(0), to: z.number().int().min(0) } },
    async (args) => {
      const a = z.object({ from: z.number().int().min(0), to: z.number().int().min(0) }).parse(args);
      await bridge.callController("moveFrame", [a.from, a.to]);
      return { content: [{ type: "text", text: `Moved frame ${a.from} → ${a.to}` }] };
    }
  );

  server.registerTool(
    "set_fps",
    { description: "Set animation playback speed (frames per second).",
      inputSchema: { fps: z.number().int().min(1).max(60) } },
    async (args) => {
      const fps = z.number().int().min(1).max(60).parse(args?.fps);
      await bridge.callController("setFPS", [fps]);
      return { content: [{ type: "text", text: `FPS = ${fps}` }] };
    }
  );
}
```

> Implementer note: confirm method names `addFrameAtCurrentIndex`, `duplicateCurrentFrame`, `duplicateFrameAt`, `removeFrameAt`, `setCurrentFrameIndex`, `moveFrame` exist on the controller (`PublicPiskelController.js:26-32` confirms most; `setFPS` is on the underlying `PiskelController` — grep `setFPS` in `src/js/controller/piskel/` to confirm exact name). Adjust if a name differs.

- [ ] **Step 2: Register + build**

Add to `server.ts`:
```ts
import { registerFrameTools } from "./tools/frames.js";
registerFrameTools(server);
```
Run: `cd mcp && npm run build`
Expected: compiles clean.

- [ ] **Step 3: Commit**

```bash
git add mcp/src/tools/frames.ts mcp/src/server.ts
git commit -m "feat(mcp): add frame tools"
```

---

### Task 14: Layer tools

**Files:**
- Create: `mcp/src/tools/layers.ts`
- Modify: `mcp/src/server.ts`

- [ ] **Step 1: Create `mcp/src/tools/layers.ts`**

```ts
// mcp/src/tools/layers.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as bridge from "../piskel-bridge.js";

export function registerLayerTools(server: McpServer): void {
  server.registerTool(
    "add_layer",
    { description: "Add a new layer on top.", inputSchema: { name: z.string().optional() } },
    async (args) => {
      await bridge.callController("createLayer", [args?.name as string | undefined]);
      const info = await bridge.getCanvasInfo();
      return { content: [{ type: "text", text: `Layers: ${info.layerCount}` }] };
    }
  );

  server.registerTool(
    "select_layer",
    { description: "Select the current layer.", inputSchema: { index: z.number().int().min(0) } },
    async (args) => {
      const idx = z.number().int().min(0).parse(args?.index);
      await bridge.callController("setCurrentLayerIndex", [idx]);
      return { content: [{ type: "text", text: `Selected layer ${idx}` }] };
    }
  );

  server.registerTool(
    "rename_layer",
    { description: "Rename a layer by index.",
      inputSchema: { index: z.number().int().min(0), name: z.string().min(1) } },
    async (args) => {
      const a = z.object({ index: z.number().int().min(0), name: z.string().min(1) }).parse(args);
      await bridge.callController("renameLayerAt", [a.index, a.name]);
      return { content: [{ type: "text", text: `Renamed layer ${a.index} → ${a.name}` }] };
    }
  );

  server.registerTool(
    "set_layer_opacity",
    { description: "Set a layer's opacity (0..1).",
      inputSchema: { index: z.number().int().min(0), opacity: z.number().min(0).max(1) } },
    async (args) => {
      const a = z.object({ index: z.number().int().min(0), opacity: z.number().min(0).max(1) }).parse(args);
      await bridge.callController("setLayerOpacityAt", [a.index, a.opacity]);
      return { content: [{ type: "text", text: `Layer ${a.index} opacity = ${a.opacity}` }] };
    }
  );

  server.registerTool(
    "move_layer",
    { description: "Move a layer up or down.",
      inputSchema: { index: z.number().int().min(0), direction: z.enum(["up", "down"]) } },
    async (args) => {
      const a = z.object({ index: z.number().int().min(0), direction: z.enum(["up", "down"]) }).parse(args);
      await bridge.callController("setCurrentLayerIndex", [a.index]);
      await bridge.callController(a.direction === "up" ? "moveLayerUp" : "moveLayerDown");
      return { content: [{ type: "text", text: `Moved layer ${a.index} ${a.direction}` }] };
    }
  );

  server.registerTool(
    "merge_layer_down",
    { description: "Merge a layer into the one below it.",
      inputSchema: { index: z.number().int().min(0) } },
    async (args) => {
      const idx = z.number().int().min(0).parse(args?.index);
      await bridge.callController("mergeDownLayerAt", [idx]);
      return { content: [{ type: "text", text: `Merged layer ${idx} down` }] };
    }
  );

  server.registerTool(
    "remove_layer",
    { description: "Remove a layer. Refuses to remove the last layer.",
      inputSchema: { index: z.number().int().min(0) } },
    async (args) => {
      const idx = z.number().int().min(0).parse(args?.index);
      const info = await bridge.getCanvasInfo();
      if (info.layerCount <= 1) {
        return { content: [{ type: "text", text: "Cannot remove the last layer." }], isError: true };
      }
      await bridge.callController("setCurrentLayerIndex", [idx]);
      await bridge.callController("removeCurrentLayer");
      return { content: [{ type: "text", text: `Removed layer ${idx}` }] };
    }
  );
}
```

> Implementer note: `createLayer`, `renameLayerAt`, `setLayerOpacityAt`, `mergeDownLayerAt`, `moveLayerUp/Down`, `removeCurrentLayer`, `setCurrentLayerIndex` are all wrapped in `PublicPiskelController.js:17-39`. Confirm `createLayer` accepts an optional name; if not, follow `createLayer()` with `renameLayerAt`.

- [ ] **Step 2: Register + build**

```ts
import { registerLayerTools } from "./tools/layers.js";
registerLayerTools(server);
```
Run: `cd mcp && npm run build`
Expected: compiles clean.

- [ ] **Step 3: Commit**

```bash
git add mcp/src/tools/layers.ts mcp/src/server.ts
git commit -m "feat(mcp): add layer tools"
```

---

### Task 15: Color helper tools + structure integration test

**Files:**
- Create: `mcp/src/tools/color.ts`
- Modify: `mcp/src/server.ts`
- Create: `mcp/src/structure.integration.test.ts`

- [ ] **Step 1: Add `getPalette`/`setPrimaryColor` helpers to `injected/piskel-helper.js`**

Append inside the `window.__piskelMcp = { ... }` object (before the closing `}`), adding a comma after the previous entry:

```js
    ,getPalette: function () {
      var piskel = pc().getPiskel();
      var used = {};
      piskel.getLayers().forEach(function (layer) {
        layer.getFrames().forEach(function (frame) {
          frame.forEachPixel(function (color) {
            if (color !== 0) used[color] = true;
          });
        });
      });
      return Object.keys(used).map(Number);
    },
    setPrimaryColor: function (hex) {
      if (window.pskl.app.paletteController &&
          window.pskl.app.paletteController.setPrimaryColor) {
        window.pskl.app.paletteController.setPrimaryColor(hex);
        return true;
      }
      return false;
    }
```

> Implementer note: confirm `pskl.app.paletteController.setPrimaryColor` exists (grep `setPrimaryColor` in `src/js/controller`). If the API differs, `set_primary_color` may be dropped — it is a convenience only and not required for drawing.

- [ ] **Step 2: Add bridge wrappers in `mcp/src/piskel-bridge.ts`**

```ts
export async function getPalette(): Promise<number[]> {
  const { page } = await getSession();
  return page.evaluate(() => window.__piskelMcp.getPalette()) as Promise<number[]>;
}

export async function setPrimaryColor(hex: string): Promise<boolean> {
  const { page } = await getSession();
  return page.evaluate((h) => window.__piskelMcp.setPrimaryColor(h), hex) as Promise<boolean>;
}
```

And extend the `__piskelMcp` type in `mcp/src/global.d.ts`:

```ts
      getPalette: () => number[];
      setPrimaryColor: (hex: string) => boolean;
```

- [ ] **Step 3: Create `mcp/src/tools/color.ts`**

```ts
// mcp/src/tools/color.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ColorSchema } from "../schemas.js";
import * as bridge from "../piskel-bridge.js";
import { intToHex } from "../color.js";

export function registerColorTools(server: McpServer): void {
  server.registerTool(
    "set_primary_color",
    { description: "Update the UI primary color swatch (convenience for manual edits).",
      inputSchema: { color: ColorSchema } },
    async (args) => {
      const color = ColorSchema.parse(args?.color);
      const ok = await bridge.setPrimaryColor(color);
      return { content: [{ type: "text", text: ok ? `Primary = ${color}` : "Not supported" }] };
    }
  );

  server.registerTool(
    "get_palette",
    { description: "Return the distinct colors currently used in the sprite.", inputSchema: {} },
    async () => {
      const ints = await bridge.getPalette();
      return { content: [{ type: "text", text: JSON.stringify(ints.map(intToHex)) }] };
    }
  );
}
```

- [ ] **Step 4: Register in `server.ts`**

```ts
import { registerColorTools } from "./tools/color.js";
registerColorTools(server);
```

- [ ] **Step 5: Write structure integration test**

```ts
// mcp/src/structure.integration.test.ts
import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { newCanvas, callController, getCanvasInfo, applyPixels, getPalette } from "./piskel-bridge.js";
import { shutdown } from "./browser.js";

describe("structure integration", () => {
  beforeAll(async () => { await newCanvas(8, 8, "struct", 12); });
  afterAll(async () => { await shutdown(); });

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
```

- [ ] **Step 6: Build + run integration**

Run: `cd mcp && npm run build && npx vitest run src/structure.integration.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 7: Commit**

```bash
git add mcp/src/tools/color.ts mcp/src/piskel-bridge.ts mcp/src/global.d.ts mcp/injected/piskel-helper.js mcp/src/server.ts mcp/src/structure.integration.test.ts
git commit -m "feat(mcp): add color tools + structure integration tests"
```

---

## Milestone 4 — Persistence, export, history

### Task 16: Save/load `.piskel`

**Files:**
- Create: `mcp/src/tools/persistence.ts`
- Modify: `mcp/src/piskel-bridge.ts`, `mcp/src/global.d.ts`, `mcp/injected/piskel-helper.js`, `mcp/src/server.ts`

- [ ] **Step 1: Add serialize/deserialize helpers to `injected/piskel-helper.js`**

Append to `window.__piskelMcp` (comma-separated):

```js
    ,serialize: function () {
      return window.pskl.utils.serialization.Serializer.serialize(pc().getPiskel());
    },
    loadFromString: function (data) {
      return new Promise(function (resolve, reject) {
        try {
          var parsed = typeof data === "string" ? JSON.parse(data) : data;
          window.pskl.utils.serialization.Deserializer.deserialize(parsed, function (piskel) {
            pc().setPiskel(piskel);
            resolve(true);
          }, function (e) { reject(e); });
        } catch (e) { reject(e); }
      });
    }
```

- [ ] **Step 2: Add bridge wrappers in `piskel-bridge.ts`**

```ts
export async function serializePiskel(): Promise<string> {
  const { page } = await getSession();
  return page.evaluate(() => window.__piskelMcp.serialize()) as Promise<string>;
}

export async function loadPiskelString(data: string): Promise<void> {
  const { page } = await getSession();
  await page.evaluate((d) => window.__piskelMcp.loadFromString(d), data);
}
```

Extend `global.d.ts` `__piskelMcp` type:

```ts
      serialize: () => string;
      loadFromString: (data: string) => Promise<boolean>;
```

- [ ] **Step 3: Create `mcp/src/tools/persistence.ts`**

```ts
// mcp/src/tools/persistence.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { PathSchema } from "../schemas.js";
import { writeFile, readFile } from "node:fs/promises";
import { resolve, isAbsolute } from "node:path";
import * as bridge from "../piskel-bridge.js";

function resolvePath(p: string): string {
  if (isAbsolute(p)) return p;
  const base = process.env.PISKEL_MCP_EXPORT_DIR ?? process.cwd();
  return resolve(base, p);
}

export function registerPersistenceTools(server: McpServer): void {
  server.registerTool(
    "save_piskel",
    { description: "Serialize the current document and write it to a .piskel file.", inputSchema: PathSchema.shape },
    async (args) => {
      const { path } = PathSchema.parse(args);
      const full = resolvePath(path);
      const data = await bridge.serializePiskel();
      await writeFile(full, data, "utf-8");
      return { content: [{ type: "text", text: `Saved ${full}` }] };
    }
  );

  server.registerTool(
    "load_piskel",
    { description: "Load a .piskel file, replacing the current document.", inputSchema: PathSchema.shape },
    async (args) => {
      const { path } = PathSchema.parse(args);
      const full = resolvePath(path);
      const data = await readFile(full, "utf-8");
      await bridge.loadPiskelString(data);
      const info = await bridge.getCanvasInfo();
      return { content: [{ type: "text", text: `Loaded ${full} (${info.width}x${info.height}, ${info.frameCount} frames)` }] };
    }
  );
}
```

- [ ] **Step 4: Register + build**

```ts
import { registerPersistenceTools } from "./tools/persistence.js";
registerPersistenceTools(server);
```
Run: `cd mcp && npm run build`
Expected: compiles clean.

- [ ] **Step 5: Commit**

```bash
git add mcp/src/tools/persistence.ts mcp/src/piskel-bridge.ts mcp/src/global.d.ts mcp/injected/piskel-helper.js mcp/src/server.ts
git commit -m "feat(mcp): add save/load .piskel tools"
```

---

### Task 17: Export PNG / spritesheet / GIF

**Files:**
- Modify: `mcp/injected/piskel-helper.js`, `mcp/src/piskel-bridge.ts`, `mcp/src/global.d.ts`
- Create: `mcp/src/tools/export.ts`
- Modify: `mcp/src/server.ts`

- [ ] **Step 1: Add export renderers to `injected/piskel-helper.js`**

Append to `window.__piskelMcp` (comma-separated). These reuse Piskel's in-browser renderers.

```js
    ,exportFramePng: function (scale, frameIndex) {
      var piskel = pc().getPiskel();
      var fi = frameIndex == null ? pc().currentFrameIndex : frameIndex;
      // Merge all visible layers for this frame index.
      var merged = window.pskl.utils.LayerUtils.mergeFrameAt(piskel.getLayers(), fi);
      var renderer = new window.pskl.rendering.frame.CanvasRenderer(merged, scale);
      return renderer.render().toDataURL();
    },
    exportSpritesheetPng: function (scale, columns) {
      var piskel = pc().getPiskel();
      var frames = [];
      var count = pc().getFrameCount();
      for (var i = 0; i < count; i++) {
        frames.push(window.pskl.utils.LayerUtils.mergeFrameAt(piskel.getLayers(), i));
      }
      var renderer = new window.pskl.rendering.FramesheetRenderer(frames, columns || count);
      var canvas = renderer.renderAsCanvas();
      if (scale && scale !== 1) {
        var scaled = document.createElement("canvas");
        scaled.width = canvas.width * scale;
        scaled.height = canvas.height * scale;
        var ctx = scaled.getContext("2d");
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(canvas, 0, 0, scaled.width, scaled.height);
        canvas = scaled;
      }
      return canvas.toDataURL();
    }
```

> Implementer note (important — verify constructors during this task):
> - Grep `src/js/utils/LayerUtils.js` for the merge helper (`mergeFrameAt` or similar). Adjust the name if different.
> - `FramesheetRenderer` is confirmed (`Serializer.js:89`). Confirm its constructor signature accepts a column count; if not, render then accept its default layout.
> - For GIF, Piskel has a GIF export path. Grep `src/js/rendering` and `src/js/service/ImageUploadService`/`GifRenderer` for the in-app encoder and call it the same way the export UI does. If exposing it cleanly proves hard, the fallback is: export a spritesheet PNG + a JSON `{frameCount, fps, columns}` sidecar and note GIF is deferred. Decide during this task; do not leave a half-working GIF tool.

- [ ] **Step 2: Add bridge wrappers + types**

In `piskel-bridge.ts`:

```ts
export async function exportFramePng(scale: number, frame?: number): Promise<string> {
  const { page } = await getSession();
  const dataUrl = (await page.evaluate(
    (a) => window.__piskelMcp.exportFramePng(a.scale, a.frame ?? null),
    { scale, frame }
  )) as string;
  return dataUrl.replace(/^data:image\/png;base64,/, "");
}

export async function exportSpritesheetPng(scale: number, columns?: number): Promise<string> {
  const { page } = await getSession();
  const dataUrl = (await page.evaluate(
    (a) => window.__piskelMcp.exportSpritesheetPng(a.scale, a.columns ?? null),
    { scale, columns }
  )) as string;
  return dataUrl.replace(/^data:image\/png;base64,/, "");
}
```

In `global.d.ts` `__piskelMcp` type:

```ts
      exportFramePng: (scale: number, frame: number | null) => string;
      exportSpritesheetPng: (scale: number, columns: number | null) => string;
```

- [ ] **Step 3: Create `mcp/src/tools/export.ts`**

```ts
// mcp/src/tools/export.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { writeFile } from "node:fs/promises";
import { resolve, isAbsolute } from "node:path";
import * as bridge from "../piskel-bridge.js";

function resolvePath(p: string): string {
  if (isAbsolute(p)) return p;
  const base = process.env.PISKEL_MCP_EXPORT_DIR ?? process.cwd();
  return resolve(base, p);
}
async function writePng(path: string, b64: string): Promise<string> {
  const full = resolvePath(path);
  await writeFile(full, Buffer.from(b64, "base64"));
  return full;
}

export function registerExportTools(server: McpServer): void {
  server.registerTool(
    "export_png",
    { description: "Export the current (or given) frame as a PNG file.",
      inputSchema: { path: z.string().min(1), scale: z.number().int().min(1).max(32).default(1),
        frame: z.number().int().min(0).optional() } },
    async (args) => {
      const a = z.object({ path: z.string().min(1), scale: z.number().int().min(1).max(32).default(1),
        frame: z.number().int().min(0).optional() }).parse(args);
      const b64 = await bridge.exportFramePng(a.scale, a.frame);
      const full = await writePng(a.path, b64);
      return { content: [{ type: "text", text: `Exported ${full}` }] };
    }
  );

  server.registerTool(
    "export_spritesheet",
    { description: "Export all frames as a single sprite-sheet PNG.",
      inputSchema: { path: z.string().min(1), scale: z.number().int().min(1).max(32).default(1),
        columns: z.number().int().min(1).optional() } },
    async (args) => {
      const a = z.object({ path: z.string().min(1), scale: z.number().int().min(1).max(32).default(1),
        columns: z.number().int().min(1).optional() }).parse(args);
      const b64 = await bridge.exportSpritesheetPng(a.scale, a.columns);
      const full = await writePng(a.path, b64);
      return { content: [{ type: "text", text: `Exported ${full}` }] };
    }
  );
}
```

> `export_gif` is registered here too only if Step 1's GIF path was implemented. If GIF was deferred, omit the tool and update README/spec "out of scope" note. Do not ship a non-functional GIF tool.

- [ ] **Step 4: Register + build**

```ts
import { registerExportTools } from "./tools/export.js";
registerExportTools(server);
```
Run: `cd mcp && npm run build`
Expected: compiles clean.

- [ ] **Step 5: Export integration test**

Create `mcp/src/export.integration.test.ts`:

```ts
import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { newCanvas, applyPixels, exportFramePng, exportSpritesheetPng } from "./piskel-bridge.js";
import { shutdown } from "./browser.js";

describe("export integration", () => {
  beforeAll(async () => {
    await newCanvas(8, 8, "exp", 12);
    await applyPixels([{ x: 0, y: 0, color: "#FF0000" }]);
  });
  afterAll(async () => { await shutdown(); });

  it("exports a non-empty frame PNG", async () => {
    const b64 = await exportFramePng(4);
    expect(Buffer.from(b64, "base64").length).toBeGreaterThan(50);
  }, 60000);

  it("exports a non-empty spritesheet PNG", async () => {
    const b64 = await exportSpritesheetPng(1);
    expect(Buffer.from(b64, "base64").length).toBeGreaterThan(50);
  }, 60000);
});
```

Run: `cd mcp && npx vitest run src/export.integration.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add mcp/src/tools/export.ts mcp/src/piskel-bridge.ts mcp/src/global.d.ts mcp/injected/piskel-helper.js mcp/src/server.ts mcp/src/export.integration.test.ts
git commit -m "feat(mcp): add PNG/spritesheet export tools"
```

---

### Task 18: Undo / redo tools

**Files:**
- Modify: `mcp/src/piskel-bridge.ts`, `mcp/src/tools/session.ts`

- [ ] **Step 1: Add undo/redo to the bridge**

In `piskel-bridge.ts`:

```ts
export async function historyAction(action: "undo" | "redo"): Promise<void> {
  const { page } = await getSession();
  await page.evaluate((a) => {
    const hs = window.pskl.app.historyService;
    if (a === "undo") hs.undo(); else hs.redo();
  }, action);
}
```

> Implementer note: confirm `window.pskl.app.historyService` is exposed (grep `pskl.app.historyService` in `src/js`). If not exposed, drive it via keyboard like the e2e tests (`testutils.ts:762-768`) using `page.keyboard.press`.

- [ ] **Step 2: Add tools in `mcp/src/tools/session.ts`**

Inside `registerSessionTools`, before the closing brace:

```ts
  server.registerTool(
    "undo",
    { description: "Undo the last change.", inputSchema: {} },
    async () => { const b = await import("../piskel-bridge.js"); await b.historyAction("undo");
      return { content: [{ type: "text", text: "Undone" }] }; }
  );
  server.registerTool(
    "redo",
    { description: "Redo the last undone change.", inputSchema: {} },
    async () => { const b = await import("../piskel-bridge.js"); await b.historyAction("redo");
      return { content: [{ type: "text", text: "Redone" }] }; }
  );
```

- [ ] **Step 3: Build**

Run: `cd mcp && npm run build`
Expected: compiles clean.

- [ ] **Step 4: Commit**

```bash
git add mcp/src/piskel-bridge.ts mcp/src/tools/session.ts
git commit -m "feat(mcp): add undo/redo tools"
```

---

### Task 19: End-to-end smoke script + README tool reference

**Files:**
- Create: `mcp/src/smoke.integration.test.ts`
- Modify: `mcp/README.md`

- [ ] **Step 1: Write the smoke test**

```ts
// mcp/src/smoke.integration.test.ts
import { describe, it, expect, afterAll } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stat } from "node:fs/promises";
import * as bridge from "./piskel-bridge.js";
import { line } from "./geometry.js";
import { writeFile } from "node:fs/promises";
import { shutdown } from "./browser.js";

describe("smoke: draw + animate + export", () => {
  afterAll(async () => { await shutdown(); });

  it("draws a 16x16 sprite across 2 frames and exports a spritesheet", async () => {
    await bridge.newCanvas(16, 16, "smoke", 12);
    await bridge.applyPixels(line(0, 0, 15, 15).map((p) => ({ ...p, color: "#FF0000" })));
    await bridge.callController("duplicateCurrentFrame");
    await bridge.callController("setCurrentFrameIndex", [1]);
    await bridge.applyPixels(line(0, 15, 15, 0).map((p) => ({ ...p, color: "#00FF00" })));

    const sheet = await bridge.exportSpritesheetPng(2);
    const out = join(tmpdir(), `piskel-smoke-${Date.now()}.png`);
    await writeFile(out, Buffer.from(sheet, "base64"));
    const s = await stat(out);
    expect(s.size).toBeGreaterThan(100);
  }, 90000);
});
```

- [ ] **Step 2: Run smoke**

Run: `cd mcp && npx vitest run src/smoke.integration.test.ts`
Expected: PASS — a window opens, draws two diagonal lines across two frames, writes a non-empty PNG.

- [ ] **Step 3: Expand README tool reference**

Append a "## Tool reference" section to `mcp/README.md` listing all tools grouped (Session/Canvas, Drawing, Frames, Layers, Color, Reads, Persistence, Export, History) with one-line descriptions matching the registered tools.

- [ ] **Step 4: Commit**

```bash
git add mcp/src/smoke.integration.test.ts mcp/README.md
git commit -m "test(mcp): add end-to-end smoke + full README tool reference"
```

---

## Final verification

- [ ] **Run all unit tests:** `cd mcp && npx vitest run src/color.test.ts src/geometry.test.ts src/schemas.test.ts` → all PASS.
- [ ] **Run all integration tests (build must exist):** `npm run build` (root) then `cd mcp && npx vitest run` → all PASS.
- [ ] **Manual:** wire the server into your agent's MCP config (README), ask it to "draw a 16×16 red heart and export PNG", and confirm the browser opens and the file is written.
- [ ] **Update spec status:** mark `docs/superpowers/specs/2026-06-04-piskel-mcp-server-design.md` status as "Implemented" and note any deviations (GIF, renderer/controller method names) discovered during Tasks 5/8/13/14/17.
