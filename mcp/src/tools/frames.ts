// mcp/src/tools/frames.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as bridge from "../piskel-bridge.js";

export function registerFrameTools(server: McpServer): void {
  server.registerTool(
    "add_frame",
    {
      description:
        "Add a new frame. duplicateCurrent=true copies the current frame.",
      inputSchema: { duplicateCurrent: z.boolean().default(false) }
    },
    async (args) => {
      const dup = z.boolean().default(false).parse(args?.duplicateCurrent);
      await bridge.callController(
        dup ? "duplicateCurrentFrame" : "addFrameAtCurrentIndex"
      );
      const info = await bridge.getCanvasInfo();
      return {
        content: [{ type: "text", text: `Frames: ${info.frameCount}` }]
      };
    }
  );

  server.registerTool(
    "duplicate_frame",
    {
      description: "Duplicate a frame by index (defaults to current).",
      inputSchema: { index: z.number().int().min(0).optional() }
    },
    async (args) => {
      const info = await bridge.getCanvasInfo();
      const idx = (args?.index as number) ?? info.currentFrame;
      await bridge.callController("duplicateFrameAt", [idx]);
      return { content: [{ type: "text", text: `Duplicated frame ${idx}` }] };
    }
  );

  server.registerTool(
    "remove_frame",
    {
      description: "Remove a frame by index. Refuses to remove the last frame.",
      inputSchema: { index: z.number().int().min(0) }
    },
    async (args) => {
      const idx = z.number().int().min(0).parse(args?.index);
      const info = await bridge.getCanvasInfo();
      if (info.frameCount <= 1) {
        return {
          content: [{ type: "text", text: "Cannot remove the last frame." }],
          isError: true
        };
      }
      await bridge.callController("removeFrameAt", [idx]);
      return { content: [{ type: "text", text: `Removed frame ${idx}` }] };
    }
  );

  server.registerTool(
    "select_frame",
    {
      description: "Select the current frame; subsequent drawing targets it.",
      inputSchema: { index: z.number().int().min(0) }
    },
    async (args) => {
      const idx = z.number().int().min(0).parse(args?.index);
      await bridge.callController("setCurrentFrameIndex", [idx]);
      return { content: [{ type: "text", text: `Selected frame ${idx}` }] };
    }
  );

  server.registerTool(
    "move_frame",
    {
      description: "Reorder a frame from one index to another.",
      inputSchema: {
        from: z.number().int().min(0),
        to: z.number().int().min(0)
      }
    },
    async (args) => {
      const a = z
        .object({ from: z.number().int().min(0), to: z.number().int().min(0) })
        .parse(args);
      await bridge.callController("moveFrame", [a.from, a.to]);
      return {
        content: [{ type: "text", text: `Moved frame ${a.from} → ${a.to}` }]
      };
    }
  );

  server.registerTool(
    "set_fps",
    {
      description: "Set animation playback speed (frames per second).",
      inputSchema: { fps: z.number().int().min(1).max(60) }
    },
    async (args) => {
      const fps = z.number().int().min(1).max(60).parse(args?.fps);
      await bridge.callController("setFPS", [fps]);
      return { content: [{ type: "text", text: `FPS = ${fps}` }] };
    }
  );
}
