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
    {
      description: "Get the hex color at (x,y).",
      inputSchema: GetPixelSchema.shape
    },
    async (args) => {
      const a = GetPixelSchema.parse(args);
      const value = await bridge.getPixelInt(a.x, a.y, a.layer, a.frame);
      return { content: [{ type: "text", text: intToHex(value) }] };
    }
  );

  server.registerTool(
    "get_grid",
    {
      description:
        "Return the frame as a 2D grid of hex colors (best for small canvases).",
      inputSchema: GridSchema.shape
    },
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
