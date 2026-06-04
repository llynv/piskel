// mcp/src/tools/export.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { writeFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { z } from "zod";
import * as bridge from "../piskel-bridge.js";

function resolvePath(p: string): string {
  if (isAbsolute(p)) {
    return p;
  }
  const base = process.env.PISKEL_MCP_EXPORT_DIR ?? process.cwd();
  return resolve(base, p);
}

async function writeImage(path: string, b64: string): Promise<string> {
  const full = resolvePath(path);
  await writeFile(full, Buffer.from(b64, "base64"));
  return full;
}

const PngSchema = z.object({
  path: z.string().min(1),
  scale: z.number().int().min(1).max(32).default(1),
  frame: z.number().int().min(0).optional()
});

const SpritesheetSchema = z.object({
  path: z.string().min(1),
  scale: z.number().int().min(1).max(32).default(1),
  columns: z.number().int().min(1).optional()
});

const GifSchema = z.object({
  path: z.string().min(1),
  scale: z.number().int().min(1).max(32).default(1),
  fps: z.number().int().min(1).max(60).optional()
});

export function registerExportTools(server: McpServer): void {
  server.registerTool(
    "export_png",
    {
      description: "Export the current (or given) frame as a PNG file.",
      inputSchema: PngSchema.shape
    },
    async (args) => {
      const a = PngSchema.parse(args);
      const b64 = await bridge.renderPng(a.scale, a.frame);
      const full = await writeImage(a.path, b64);
      return { content: [{ type: "text", text: `Exported ${full}` }] };
    }
  );

  server.registerTool(
    "export_spritesheet",
    {
      description:
        "Export all frames composited into a single sprite-sheet PNG (columns defaults to one row).",
      inputSchema: SpritesheetSchema.shape
    },
    async (args) => {
      const a = SpritesheetSchema.parse(args);
      const b64 = await bridge.renderSpritesheet(a.scale, a.columns);
      const full = await writeImage(a.path, b64);
      return { content: [{ type: "text", text: `Exported ${full}` }] };
    }
  );

  server.registerTool(
    "export_gif",
    {
      description:
        "Export all frames as an animated GIF file (fps defaults to the document's fps).",
      inputSchema: GifSchema.shape
    },
    async (args) => {
      const a = GifSchema.parse(args);
      const b64 = await bridge.renderGif(a.scale, a.fps);
      const full = await writeImage(a.path, b64);
      return { content: [{ type: "text", text: `Exported ${full}` }] };
    }
  );
}
