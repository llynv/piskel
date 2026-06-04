// mcp/src/tools/layers.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as bridge from "../piskel-bridge.js";

export function registerLayerTools(server: McpServer): void {
  server.registerTool(
    "add_layer",
    {
      description: "Add a new layer on top.",
      inputSchema: { name: z.string().optional() }
    },
    async (args) => {
      await bridge.callController("createLayer", [
        args?.name as string | undefined
      ]);
      const info = await bridge.getCanvasInfo();
      return {
        content: [{ type: "text", text: `Layers: ${info.layerCount}` }]
      };
    }
  );

  server.registerTool(
    "select_layer",
    {
      description: "Select the current layer.",
      inputSchema: { index: z.number().int().min(0) }
    },
    async (args) => {
      const idx = z.number().int().min(0).parse(args?.index);
      await bridge.callController("setCurrentLayerIndex", [idx]);
      return { content: [{ type: "text", text: `Selected layer ${idx}` }] };
    }
  );

  server.registerTool(
    "rename_layer",
    {
      description: "Rename a layer by index.",
      inputSchema: { index: z.number().int().min(0), name: z.string().min(1) }
    },
    async (args) => {
      const a = z
        .object({ index: z.number().int().min(0), name: z.string().min(1) })
        .parse(args);
      await bridge.callController("renameLayerAt", [a.index, a.name]);
      return {
        content: [
          { type: "text", text: `Renamed layer ${a.index} → ${a.name}` }
        ]
      };
    }
  );

  server.registerTool(
    "set_layer_opacity",
    {
      description: "Set a layer's opacity (0..1).",
      inputSchema: {
        index: z.number().int().min(0),
        opacity: z.number().min(0).max(1)
      }
    },
    async (args) => {
      const a = z
        .object({
          index: z.number().int().min(0),
          opacity: z.number().min(0).max(1)
        })
        .parse(args);
      await bridge.callController("setLayerOpacityAt", [a.index, a.opacity]);
      return {
        content: [
          { type: "text", text: `Layer ${a.index} opacity = ${a.opacity}` }
        ]
      };
    }
  );

  server.registerTool(
    "move_layer",
    {
      description: "Move a layer up or down.",
      inputSchema: {
        index: z.number().int().min(0),
        direction: z.enum(["up", "down"])
      }
    },
    async (args) => {
      const a = z
        .object({
          index: z.number().int().min(0),
          direction: z.enum(["up", "down"])
        })
        .parse(args);
      await bridge.callController("setCurrentLayerIndex", [a.index]);
      await bridge.callController(
        a.direction === "up" ? "moveLayerUp" : "moveLayerDown"
      );
      return {
        content: [
          { type: "text", text: `Moved layer ${a.index} ${a.direction}` }
        ]
      };
    }
  );

  server.registerTool(
    "merge_layer_down",
    {
      description: "Merge a layer into the one below it.",
      inputSchema: { index: z.number().int().min(0) }
    },
    async (args) => {
      const idx = z.number().int().min(0).parse(args?.index);
      await bridge.callController("mergeDownLayerAt", [idx]);
      return { content: [{ type: "text", text: `Merged layer ${idx} down` }] };
    }
  );

  server.registerTool(
    "remove_layer",
    {
      description: "Remove a layer. Refuses to remove the last layer.",
      inputSchema: { index: z.number().int().min(0) }
    },
    async (args) => {
      const idx = z.number().int().min(0).parse(args?.index);
      const info = await bridge.getCanvasInfo();
      if (info.layerCount <= 1) {
        return {
          content: [{ type: "text", text: "Cannot remove the last layer." }],
          isError: true
        };
      }
      await bridge.callController("setCurrentLayerIndex", [idx]);
      await bridge.callController("removeCurrentLayer");
      return { content: [{ type: "text", text: `Removed layer ${idx}` }] };
    }
  );
}
