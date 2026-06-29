#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createChaeggimiServer } from "./mcpServer.js";
import { ChaeggimiStore } from "./store.js";

async function main() {
  const store = new ChaeggimiStore();
  const server = createChaeggimiServer(store);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("챙기미 MCP 서버 시작 실패:", error);
  process.exit(1);
});
