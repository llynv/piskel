// mcp/src/tools/color.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ColorSchema } from "../schemas.js";
import * as bridge from "../piskel-bridge.js";
import { intToHex } from "../color.js";

export function registerColorTools(server: McpServer): void {
  server.registerTool(
    "set_primary_color",
    {
      description:
        "Update the UI primary color swatch (convenience for manual edits).",
      inputSchema: { color: ColorSchema }
    },
    async (args) => {
      const color = ColorSchema.parse(args?.color);
      const ok = await bridge.setPrimaryColor(color);
      return {
        content: [
          { type: "text", text: ok ? `Primary = ${color}` : "Not supported" }
        ]
      };
    }
  );

  server.registerTool(
    "get_palette",
    {
      description: "Return the distinct colors currently used in the sprite.",
      inputSchema: {}
    },
    async () => {
      const ints = await bridge.getPalette();
      return {
        content: [{ type: "text", text: JSON.stringify(ints.map(intToHex)) }]
      };
    }
  );
}
