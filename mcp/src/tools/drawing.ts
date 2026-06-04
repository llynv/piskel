// mcp/src/tools/drawing.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  LineSchema,
  RectSchema,
  EllipseSchema,
  FloodFillSchema
} from "../schemas.js";
import { z } from "zod";
import { line, rect, ellipse } from "../geometry.js";
import * as bridge from "../piskel-bridge.js";

const ClearSchema = z.object({
  area: z
    .object({
      x: z.number().int().min(0),
      y: z.number().int().min(0),
      w: z.number().int().min(1),
      h: z.number().int().min(1)
    })
    .optional()
});

export function registerDrawingTools(server: McpServer): void {
  server.registerTool(
    "draw_line",
    {
      description: "Draw a line from (x1,y1) to (x2,y2).",
      inputSchema: LineSchema.shape
    },
    async (args) => {
      const a = LineSchema.parse(args);
      const pts = line(a.x1, a.y1, a.x2, a.y2).map((p) => ({
        ...p,
        color: a.color
      }));
      await bridge.applyPixels(pts);
      return {
        content: [{ type: "text", text: `Line drawn (${pts.length} px)` }]
      };
    }
  );

  server.registerTool(
    "draw_rect",
    {
      description: "Draw a rectangle outline or filled (fill=true).",
      inputSchema: RectSchema.shape
    },
    async (args) => {
      const a = RectSchema.parse(args);
      const pts = rect(a.x, a.y, a.w, a.h, a.fill).map((p) => ({
        ...p,
        color: a.color
      }));
      await bridge.applyPixels(pts);
      return {
        content: [{ type: "text", text: `Rect drawn (${pts.length} px)` }]
      };
    }
  );

  server.registerTool(
    "fill_rect",
    { description: "Draw a filled rectangle.", inputSchema: RectSchema.shape },
    async (args) => {
      const a = RectSchema.parse(args);
      const pts = rect(a.x, a.y, a.w, a.h, true).map((p) => ({
        ...p,
        color: a.color
      }));
      await bridge.applyPixels(pts);
      return {
        content: [{ type: "text", text: `Filled rect (${pts.length} px)` }]
      };
    }
  );

  server.registerTool(
    "draw_ellipse",
    {
      description:
        "Draw an ellipse outline or filled within the bounding box (x,y,w,h).",
      inputSchema: EllipseSchema.shape
    },
    async (args) => {
      const a = EllipseSchema.parse(args);
      const pts = ellipse(a.x, a.y, a.w, a.h, a.fill).map((p) => ({
        ...p,
        color: a.color
      }));
      await bridge.applyPixels(pts);
      return {
        content: [{ type: "text", text: `Ellipse drawn (${pts.length} px)` }]
      };
    }
  );

  server.registerTool(
    "flood_fill",
    {
      description: "Paint-bucket fill starting from (x,y).",
      inputSchema: FloodFillSchema.shape
    },
    async (args) => {
      const a = FloodFillSchema.parse(args);
      await bridge.floodFill(a.x, a.y, a.color);
      return {
        content: [{ type: "text", text: `Flood fill from (${a.x},${a.y})` }]
      };
    }
  );

  server.registerTool(
    "clear",
    {
      description:
        "Clear the whole current frame, or an optional rectangular area.",
      inputSchema: ClearSchema.shape
    },
    async (args) => {
      const a = ClearSchema.parse(args);
      await bridge.clearArea(a.area);
      return {
        content: [
          { type: "text", text: a.area ? "Area cleared" : "Frame cleared" }
        ]
      };
    }
  );
}
