import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { shutdown } from "../browser.js";

export function registerSessionTools(server: McpServer): void {
  server.registerTool(
    "shutdown",
    {
      description:
        "Close the Piskel browser and local server. Use only when fully done.",
      inputSchema: {}
    },
    async () => {
      await shutdown();
      return { content: [{ type: "text", text: "Piskel session closed." }] };
    }
  );
}
