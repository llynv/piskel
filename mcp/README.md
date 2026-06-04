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
On the first tool call, a Chromium window opens with Piskel loaded. It stays open for the whole session so you can watch the agent draw, then keep editing yourself afterward.

## Config (env)
- `PISKEL_MCP_URL` — target URL (default `http://localhost:9001/`)
- `PISKEL_MCP_PORT` — serve port (default `9001`)
- `PISKEL_MCP_HEADLESS` — `true` to hide the browser (default `false`)
- `PISKEL_MCP_EXPORT_DIR` — default dir for relative export/save paths

## Tools
See the design spec at `docs/superpowers/specs/2026-06-04-piskel-mcp-server-design.md` for background. The full tool reference below is grouped by category.

### Canvas
- `new_canvas` — create a blank canvas, replacing the current document. Args: `width`, `height`, `name?`, `fps?`.
- `get_canvas_info` — return current dimensions, fps, layers, frames, and selection. No args.
- `set_pixel` — set a single pixel `(x,y)` to a color on the current layer+frame. Args: `x`, `y`, `color`.
- `set_pixels` — set many pixels in one undo step (efficient for whole sprites). Args: `pixels` (array of `{x,y,color}`).
- `get_canvas_preview` — return a scaled PNG of a frame so you can see your work. Args: `scale?`, `layer?`, `frame?`.

### Drawing
- `draw_line` — draw a line from `(x1,y1)` to `(x2,y2)`. Args: `x1`, `y1`, `x2`, `y2`, `color`.
- `draw_rect` — draw a rectangle outline or filled (`fill=true`). Args: `x`, `y`, `w`, `h`, `color`, `fill?`.
- `fill_rect` — draw a filled rectangle. Args: `x`, `y`, `w`, `h`, `color`.
- `draw_ellipse` — draw an ellipse outline or filled within the bounding box `(x,y,w,h)`. Args: `x`, `y`, `w`, `h`, `color`, `fill?`.
- `flood_fill` — paint-bucket fill starting from `(x,y)`. Args: `x`, `y`, `color`.
- `clear` — clear the whole current frame, or an optional rectangular area. Args: `area?` (an object `{ x, y, w, h }`). Omit `area` to clear the entire frame.

### Reads
- `get_pixel` — get the hex color at `(x,y)`. Args: `x`, `y`, `layer?`, `frame?`.
- `get_grid` — return the frame as a 2D grid of hex colors (best for small canvases). Args: `layer?`, `frame?`.

### Frames
- `add_frame` — add a new frame; `duplicateCurrent=true` copies the current frame. Args: `duplicateCurrent?`.
- `duplicate_frame` — duplicate a frame by index (defaults to current). Args: `index?`.
- `remove_frame` — remove a frame by index (refuses to remove the last frame). Args: `index`.
- `select_frame` — select the current frame; subsequent drawing targets it. Args: `index`.
- `move_frame` — reorder a frame from one index to another. Args: `from`, `to`.
- `set_fps` — set animation playback speed (frames per second). Args: `fps`.

### Layers
- `add_layer` — add a new layer on top. No args.
- `select_layer` — select the current layer. Args: `index`.
- `rename_layer` — rename a layer by index. Args: `index`, `name`.
- `set_layer_opacity` — set a layer's opacity (`0..1`). Args: `index`, `opacity`.
- `move_layer` — move a layer up or down. Args: `index`, `direction`.
- `merge_layer_down` — merge a layer into the one below it. Args: `index`.
- `remove_layer` — remove a layer (refuses to remove the last layer). Args: `index`.

### Color
- `set_primary_color` — update the UI primary color swatch (convenience for manual edits). Args: `color`.
- `get_palette` — return the distinct colors currently used in the sprite. No args.

### Persistence
- `save_piskel` — serialize the current document and write it to a `.piskel` file. Args: `path`.
- `load_piskel` — load a `.piskel` file, replacing the current document. Args: `path`.

### Export
- `export_png` — export the current (or given) frame as a PNG file. Args: `path`, `scale?`, `frame?`.
- `export_spritesheet` — export all frames composited into a single sprite-sheet PNG (columns defaults to one row). Args: `path`, `scale?`, `columns?`.
- `export_gif` — export all frames as an animated GIF file (fps defaults to the document's fps). Args: `path`, `scale?`, `fps?`.

### History
- `undo` — undo the last change. No args.
- `redo` — redo the last undone change. No args.

### Session
- `shutdown` — close the Piskel browser and local server. Use only when fully done. No args.

### Notes for agents
- The **first tool call opens the Piskel window** and it stays open for the whole session until you call `shutdown`. Don't shut down between steps.
- Prefer **`set_pixels` (batched)** over many `set_pixel` calls when drawing a whole sprite — it's faster and collapses into a single undo step.
- `undo` immediately after a draw can be a **no-op** because of Piskel's history-snapshot interval. Wait a moment after drawing, or rely on each tool call being one undo step.
- **Save or export before finishing**: call `save_piskel` to persist the document and `export_png` / `export_spritesheet` / `export_gif` to produce final assets.
