// mcp/src/tools/history.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as bridge from "../piskel-bridge.js";

export function registerHistoryTools(server: McpServer): void {
  server.registerTool(
    "undo",
    { description: "Undo the last change.", inputSchema: {} },
    async () => {
      await bridge.undo();
      return { content: [{ type: "text", text: "Undone" }] };
    }
  );

  server.registerTool(
    "redo",
    { description: "Redo the last undone change.", inputSchema: {} },
    async () => {
      await bridge.redo();
      return { content: [{ type: "text", text: "Redone" }] };
    }
  );
}
