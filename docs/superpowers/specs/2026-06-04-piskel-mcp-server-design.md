# Piskel MCP Server — Design

**Date:** 2026-06-04
**Status:** Approved (pending implementation plan)
**Author:** Brainstorming session

## 1. Goal

Let an AI agent draw pixel-art assets in Piskel by exposing Piskel's drawing
capabilities through a Model Context Protocol (MCP) server. The agent connects
to the MCP server and issues tool calls (`new_canvas`, `draw_line`, `add_frame`,
`export_gif`, …). A real Piskel browser window stays open so the user **watches
the asset being drawn, adjusted, and animated live**.

## 2. Feasibility (verified against the codebase)

Piskel is well-suited to this:

- **Simple, accessible model.** `Piskel` → `Layer[]` → `Frame[]`, where each
  `Frame` is a flat `Uint32Array` of ABGR pixels
  (`src/js/model/Frame.js:10`). Color int = `(a<<24)+(b<<16)+(g<<8)+r`.
  `Frame` exposes `setPixel`, `getPixel`, `setPixels`, `clear`
  (`src/js/model/Frame.js:119-139`).
- **Proven programmatic surface.** The app exposes
  `window.pskl.app.piskelController`, `window.pskl.app.drawingController`,
  `window.pskl.model.*`, `window.pskl.utils.*`. The Playwright e2e tests already
  drive the live app this way via `page.evaluate()`
  (`tests/e2e/playwright/testutils.ts:81-466`).
- **Defined serialization.** `.piskel` is JSON (`Serializer.serialize`,
  `src/js/utils/serialization/Serializer.js:22`) with a matching
  `Deserializer.deserialize` (`src/js/utils/serialization/Deserializer.js:12`).
- **Deps present.** `puppeteer` and `@playwright/test` are already in
  `package.json`.

Verdict: **feasible and clean** — the MCP server reuses the exact live-control
pattern the test suite already relies on.

## 3. Chosen approach

**Live "watch it draw" via a Puppeteer bridge.** Decisions locked during
brainstorming:

1. Integration model: **live browser control** (not headless file generation).
2. Browser lifecycle: the **server launches its own visible (headed) Chromium**.
3. Target: the **local dev build**, auto-served via the repo's existing
   `scripts/serve.js` against `dest/prod` (offline, reflects local changes).
4. Scope: **drawing + layers + frames + export**, plus a `get_canvas_preview`
   visual-feedback tool so the agent can see and self-correct.
5. Close behavior: **stay open** — browser persists until the user closes it or
   the session ends; agent saves/exports before declaring done.

## 4. Architecture

```
Agent  ──MCP/stdio──►  piskel-mcp (Node)  ──Puppeteer──►  headed Chromium
                                                              └─ Piskel web app
                                                                 window.pskl.app.*
                          serves dest/prod via scripts/serve.js
```

**Data flow (one tool call):**

1. Agent calls a tool; server validates args with a zod schema.
2. Server runs `page.evaluate()` operating on `window.pskl` (same pattern as
   `testutils.ts`).
3. Inside the page: edit the live `Frame` or call a wrapped `piskelController`
   method.
4. Server publishes the correct commit event → canvas repaints, undo recorded.
5. Server returns a small result; the user sees the change in the open browser.

**Source of truth:** the live Piskel document *in the browser* is canonical. The
server keeps no parallel pixel model — it only sends commands and reads
state/previews. This prevents drift.

**Lifecycle:** the first tool call lazily (a) ensures the local Piskel server is
running, (b) launches headed Chromium, (c) waits for
`#drawing-canvas-container canvas` (mirrors `waitForEditorReady`). Browser and
server persist for the whole session. An explicit `shutdown` tool and a process
exit handler clean them up.

## 5. Browser bridge — three commit patterns

Every tool resolves to one of three patterns, all via `window.pskl` inside
`page.evaluate()`.

**Pattern A — Pixel edits** (`set_pixel`, `set_pixels`, `draw_line`,
`draw_rect`, `draw_ellipse`, `fill_rect`, `flood_fill`, `clear`):

```js
const pc    = window.pskl.app.piskelController;
const frame = pc.getCurrentFrame();
const c     = window.pskl.utils.colorToInt(hex);
frame.setPixel(x, y, c);            // bumps frame.version → live canvas repaints
// ...repeat for the whole shape...
window.jQuery.publish(window.Events.PISKEL_SAVE_STATE,
  { type: window.pskl.service.HistoryService.SNAPSHOT });  // one undo entry per call
```

One shape = many `setPixel`s + **one** save-state = one clean Ctrl-Z step. The
`version` bump (`Frame.js:128`) is what triggers the on-screen repaint.

**Pattern B — Structural ops** (`add_frame`, `duplicate_frame`, `select_frame`,
`move_frame`, `set_fps`, `add_layer`, `select_layer`, `rename_layer`,
`set_layer_opacity`, `move_layer`, `merge_layer_down`, `remove_layer`): call the
**wrapped** `piskelController` methods directly (`addFrame`,
`duplicateCurrentFrame`, `setCurrentFrameIndex`, `createLayer`,
`setLayerOpacityAt`, …). These already fire redraw + history
(`PublicPiskelController.js:26-40`).

**Pattern C — Whole-document replace** (`new_canvas`, `load_piskel`): build
`Piskel.fromLayers([...])` and call `piskelController.setPiskel(piskel)` (same as
`setPiskelFromGrid`, `testutils.ts:115`).

**Reads** (`get_pixel`, `get_grid`, `get_canvas_info`, `get_canvas_preview`):
pure `page.evaluate` reads; preview re-renders the current frame to a scaled PNG
returned as an MCP image.

**Helper injection:** a `window.__piskelMcp` helper object (line/rect/ellipse/
flood-fill in pixel space) is injected once on page load so each tool call is a
thin wrapper. Color input accepts `#RRGGBB` / `#RRGGBBAA`; transparent = `0`.

## 6. Tool catalog (~30 tools)

Colors are `#RRGGBB`/`#RRGGBBAA` (`"transparent"`/`0` = empty). Coords are
0-indexed `(x,y)` from top-left. Drawing acts on the current layer+frame unless
noted.

### A. Session & canvas
| Tool | Args | Behavior / Returns |
|---|---|---|
| `new_canvas` | `width`, `height`, `name?`, `fps?=12` | Replace doc with blank canvas (Pattern C). Returns canvas info. |
| `get_canvas_info` | — | `{width,height,fps,name,layerCount,frameCount,currentLayer,currentFrame,layers:[{name,opacity}]}`. |
| `get_canvas_preview` | `scale?=8`, `frame?`, `layer?` | Scaled PNG of frame returned as an MCP image. |

### B. Drawing (Pattern A — one undo step each)
| Tool | Args | Behavior |
|---|---|---|
| `set_pixel` | `x`, `y`, `color` | Single pixel. |
| `set_pixels` | `pixels:[{x,y,color}]` | Bulk plot; one call, one undo step. |
| `draw_line` | `x1,y1,x2,y2,color`, `size?=1` | Bresenham line. |
| `draw_rect` | `x,y,w,h,color`, `fill?=false` | Rectangle outline/filled. |
| `draw_ellipse` | `x,y,w,h,color`, `fill?=false` | Ellipse outline/filled. |
| `fill_rect` | `x,y,w,h,color` | Filled rectangle (alias of `draw_rect fill=true`). |
| `flood_fill` | `x,y,color` | Paint-bucket from seed. |
| `clear` | `area?` | Clear whole frame or a rect. |

### C. Frames (Pattern B)
| Tool | Args | Behavior |
|---|---|---|
| `add_frame` | `duplicateCurrent?=false`, `at?` | Add blank/duplicated frame. |
| `duplicate_frame` | `index?` | Duplicate (defaults current). |
| `remove_frame` | `index` | Delete a frame (guards last frame). |
| `select_frame` | `index` | Make a frame current. |
| `move_frame` | `from`, `to` | Reorder. |
| `set_fps` | `fps` | Playback speed. |

### D. Layers (Pattern B)
| Tool | Args | Behavior |
|---|---|---|
| `add_layer` | `name?` | New layer on top. |
| `select_layer` | `index` | Set current layer. |
| `rename_layer` | `index`, `name` | Rename. |
| `set_layer_opacity` | `index`, `opacity` (0–1) | Transparency. |
| `move_layer` | `index`, `direction` (up/down) | Reorder. |
| `merge_layer_down` | `index` | Flatten into layer below. |
| `remove_layer` | `index` | Delete (guards last layer). |

### E. Color helpers
| Tool | Args | Behavior |
|---|---|---|
| `set_primary_color` | `color` | Update UI primary swatch (convenience). |
| `get_palette` | — | Distinct colors currently used. |

### F. Reads & feedback
| Tool | Args | Behavior |
|---|---|---|
| `get_pixel` | `x,y,layer?,frame?` | Hex color at coord. |
| `get_grid` | `layer?,frame?` | 2D hex grid (small canvases). |

### G. Persistence & export
| Tool | Args | Behavior |
|---|---|---|
| `save_piskel` | `path` | Serialize → write `.piskel` (`Serializer.serialize`). |
| `load_piskel` | `path` | Read `.piskel` → `Deserializer` → `setPiskel`. |
| `export_png` | `path`, `scale?=1` | Current frame → PNG. |
| `export_spritesheet` | `path`, `columns?/rows?`, `scale?` | All frames → sprite sheet PNG. |
| `export_gif` | `path`, `scale?`, `fps?` | Animated GIF. |

### H. History & session
| Tool | Args | Behavior |
|---|---|---|
| `undo` / `redo` | — | Drive Piskel history. |
| `shutdown` | — | Close browser + local server (manual/explicit). |

## 7. Project layout

```
mcp/
  package.json            # @modelcontextprotocol/sdk, zod, puppeteer
  src/
    server.ts             # MCP bootstrap, stdio transport, tool registration
    browser.ts            # Puppeteer lifecycle: ensure-served + launch + readiness
    piskel-bridge.ts      # page.evaluate wrappers (Patterns A/B/C), helper injection
    tools/
      canvas.ts  drawing.ts  frames.ts  layers.ts
      color.ts   reads.ts    export.ts  session.ts
    schemas.ts            # zod schemas per tool
    color.ts              # hex <-> ABGR int (mirrors pskl.utils.colorToInt)
  injected/
    piskel-helper.js      # window.__piskelMcp pixel-space geometry
  README.md               # install, config, agent setup, tool reference
```

**Tech:** TypeScript, official `@modelcontextprotocol/sdk`, **stdio** transport,
**zod** validation, **Puppeteer** (already present). Serving reuses
`scripts/serve.js` against `dest/prod`; the server checks the build exists and
emits a clear "run `npm run build`" error otherwise.

**Config (env vars):** `PISKEL_MCP_URL` (override target URL),
`PISKEL_MCP_PORT`, `PISKEL_MCP_HEADLESS` (default `false`),
`PISKEL_MCP_EXPORT_DIR` (default dir for relative export paths).

## 8. Error handling & edge cases

- **Build missing** → fail fast with the exact build command.
- **Out-of-bounds coords** → clamped/skipped (mirrors `Frame.containsPixel`),
  never throw mid-sprite.
- **Bad color** → validation error listing accepted formats.
- **Browser died mid-session** → detect closed page, relaunch once, surface a
  clear message.
- **Last-layer / last-frame deletion** → blocked with a helpful message.
- **Large `set_pixels`** → executed in one `page.evaluate` batch (one repaint,
  one undo) for speed.
- **Path safety** → writes confined to the configured export dir or explicit
  absolute paths; refuse to overwrite outside it without confirmation.

## 9. Testing strategy

- **Unit:** color conversion, schema validation, pixel-space geometry
  (line/rect/ellipse/fill) against expected grids in pure Node.
- **Integration:** run the bridge against the real served Piskel and assert via
  the existing `readPixelGrid`/`getPixelColor` helpers (`testutils.ts`) — reuse
  the project's proven verification.
- **Smoke:** scripted "draw a 16×16 sprite, add 2 frames, export GIF" run that
  must complete and produce non-empty files.

## 10. Out of scope (v1, YAGNI)

- Multi-document / multi-tab sessions.
- Remote/hosted transport (SSE/HTTP) — stdio only for now.
- Attaching to a user-launched browser (may be added later via `PISKEL_MCP_URL`).
- Selection/transform tools (move, rotate, dithering) beyond the listed set.
