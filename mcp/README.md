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
See the design spec at `docs/superpowers/specs/2026-06-04-piskel-mcp-server-design.md` for the full catalog. The tool reference below is expanded as milestones land.

### Milestone 1 (available)
- `new_canvas` — create a blank canvas (replaces the document)
- `get_canvas_info` — dimensions, fps, layers, frames, current selection
- `set_pixel` / `set_pixels` — draw one or many pixels (one undo step)
- `get_canvas_preview` — scaled PNG of a frame, returned as an image
- `shutdown` — close the browser + local server
