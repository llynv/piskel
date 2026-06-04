// mcp/src/tools/persistence.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { readFile, writeFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import * as bridge from "../piskel-bridge.js";
import { PathSchema } from "../schemas.js";

function resolvePath(p: string): string {
  if (isAbsolute(p)) {
    return p;
  }
  const base = process.env.PISKEL_MCP_EXPORT_DIR ?? process.cwd();
  return resolve(base, p);
}

export function registerPersistenceTools(server: McpServer): void {
  server.registerTool(
    "save_piskel",
    {
      description:
        "Serialize the current document and write it to a .piskel file.",
      inputSchema: PathSchema.shape
    },
    async (args) => {
      const { path } = PathSchema.parse(args);
      const full = resolvePath(path);
      const data = await bridge.serializePiskel();
      await writeFile(full, data, "utf-8");
      return { content: [{ type: "text", text: `Saved ${full}` }] };
    }
  );

  server.registerTool(
    "load_piskel",
    {
      description: "Load a .piskel file, replacing the current document.",
      inputSchema: PathSchema.shape
    },
    async (args) => {
      const { path } = PathSchema.parse(args);
      const full = resolvePath(path);
      const data = await readFile(full, "utf-8");
      await bridge.loadPiskelString(data);
      const info = await bridge.getCanvasInfo();
      return {
        content: [
          {
            type: "text",
            text: `Loaded ${full} (${info.width}x${info.height}, ${info.frameCount} frames)`
          }
        ]
      };
    }
  );
}
