import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function loadSample(name) {
  return readFileSync(join(root, "samples", "notices", name), "utf-8");
}

async function main() {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [join(root, "dist", "index.js")],
  });
  const client = new Client({ name: "verify-script", version: "0.1.0" });
  await client.connect(transport);

  const tools = await client.listTools();
  console.log("=== tools/list ===");
  console.log(tools.tools.map((t) => t.name).join(", "));

  const extractResult = await client.callTool({
    name: "extract_notice_items",
    arguments: {
      source_type: "image_ocr_text",
      notice_text: loadSample("field-trip.txt"),
    },
  });
  const notice = JSON.parse(extractResult.content[0].text);
  console.log("\n=== extract_notice_items ===");
  console.log(JSON.stringify(notice, null, 2));

  const checklistResult = await client.callTool({
    name: "create_preparation_checklist",
    arguments: { extracted_notice: notice, child_name: "민준" },
  });
  const checklist = JSON.parse(checklistResult.content[0].text);
  console.log("\n=== create_preparation_checklist ===");
  console.log(JSON.stringify(checklist, null, 2));

  const shareResult = await client.callTool({
    name: "make_family_share_message",
    arguments: { checklist, child_name: "민준" },
  });
  console.log("\n=== make_family_share_message ===");
  console.log(JSON.stringify(JSON.parse(shareResult.content[0].text), null, 2));

  const reminderResult = await client.callTool({
    name: "create_reminder_plan",
    arguments: { extracted_notice: notice },
  });
  console.log("\n=== create_reminder_plan ===");
  console.log(JSON.stringify(JSON.parse(reminderResult.content[0].text), null, 2));

  await client.close();
}

main().catch((err) => {
  console.error("MCP 검증 실패:", err);
  process.exit(1);
});
