import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function show(label, result) {
  console.log(`\n=== ${label} ===`);
  console.log(JSON.stringify(JSON.parse(result.content[0].text), null, 2));
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

  // 데모 플로우: 예약 등록 → 가족 공유 켜기+공유문 → 약 등록 → 오늘 일정 조회 → 복약 완료 → 공유 해제
  show(
    "add_hospital_appointment",
    await client.callTool({
      name: "add_hospital_appointment",
      arguments: { hospital_name: "분당서울대병원", datetime_text: "내일 오전 10시" },
    }),
  );

  show(
    "update_share_scope (enable)",
    await client.callTool({
      name: "update_share_scope",
      arguments: { recipient_label: "딸", action: "enable" },
    }),
  );

  show(
    "generate_share_summary",
    await client.callTool({
      name: "generate_share_summary",
      arguments: { scope: "upcoming_appointment", owner_label: "저" },
    }),
  );

  show(
    "add_medication_text",
    await client.callTool({
      name: "add_medication_text",
      arguments: { medication_name: "혈압약", time_slots: ["아침", "저녁"], timing: "식후" },
    }),
  );

  show(
    "list_today_schedule",
    await client.callTool({ name: "list_today_schedule", arguments: {} }),
  );

  show(
    "mark_medication_taken",
    await client.callTool({
      name: "mark_medication_taken",
      arguments: { time_slot: "아침", taken: true },
    }),
  );

  show(
    "update_share_scope (disable)",
    await client.callTool({
      name: "update_share_scope",
      arguments: { recipient_label: "딸", action: "disable" },
    }),
  );

  await client.close();
}

main().catch((err) => {
  console.error("MCP 검증 실패:", err);
  process.exit(1);
});
