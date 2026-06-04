import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  NewCanvasSchema,
  SetPixelSchema,
  SetPixelsSchema,
  PreviewSchema
} from "../schemas.js";
import * as bridge from "../piskel-bridge.js";

export function registerCanvasTools(server: McpServer): void {
  server.registerTool(
    "new_canvas",
    {
      description:
        "Create a new blank canvas, replacing the current document. Subsequent drawing targets it.",
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
    {
      description:
        "Return current canvas dimensions, fps, layers, frames, and selection.",
      inputSchema: {}
    },
    async () => {
      const info = await bridge.getCanvasInfo();
      return { content: [{ type: "text", text: JSON.stringify(info) }] };
    }
  );

  server.registerTool(
    "set_pixel",
    {
      description:
        "Set a single pixel (x,y) to a color on the current layer+frame.",
      inputSchema: SetPixelSchema.shape
    },
    async (args) => {
      const a = SetPixelSchema.parse(args);
      await bridge.applyPixels([{ x: a.x, y: a.y, color: a.color }]);
      return {
        content: [
          { type: "text", text: `Set pixel (${a.x},${a.y}) = ${a.color}` }
        ]
      };
    }
  );

  server.registerTool(
    "set_pixels",
    {
      description:
        "Set many pixels in one undo step. Efficient for whole sprites.",
      inputSchema: SetPixelsSchema.shape
    },
    async (args) => {
      const a = SetPixelsSchema.parse(args);
      await bridge.applyPixels(a.pixels);
      return {
        content: [{ type: "text", text: `Set ${a.pixels.length} pixels` }]
      };
    }
  );

  server.registerTool(
    "get_canvas_preview",
    {
      description: "Return a scaled PNG of a frame so you can see your work.",
      inputSchema: PreviewSchema.shape
    },
    async (args) => {
      const a = PreviewSchema.parse(args);
      const b64 = await bridge.previewPng(a.scale, a.layer, a.frame);
      return { content: [{ type: "image", data: b64, mimeType: "image/png" }] };
    }
  );
}
