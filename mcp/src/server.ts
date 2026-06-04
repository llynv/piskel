import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerCanvasTools } from "./tools/canvas.js";
import { registerDrawingTools } from "./tools/drawing.js";
import { registerSessionTools } from "./tools/session.js";
import { registerReadTools } from "./tools/reads.js";
import { registerFrameTools } from "./tools/frames.js";
import { registerLayerTools } from "./tools/layers.js";
import { shutdown } from "./browser.js";

async function main(): Promise<void> {
  const server = new McpServer({ name: "piskel-mcp", version: "0.1.0" });

  registerCanvasTools(server);
  registerDrawingTools(server);
  registerSessionTools(server);
  registerReadTools(server);
  registerFrameTools(server);
  registerLayerTools(server);

  const cleanup = async () => {
    await shutdown();
    process.exit(0);
  };
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
