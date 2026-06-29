import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const url = new URL(process.env.MCP_URL ?? "http://localhost:8787/mcp");

function show(label, result) {
  console.log(`\n=== ${label} ===`);
  console.log(JSON.stringify(JSON.parse(result.content[0].text), null, 2));
}

async function main() {
  const transport = new StreamableHTTPClientTransport(url);
  const client = new Client({ name: "verify-http-script", version: "0.1.0" });
  await client.connect(transport);

  const tools = await client.listTools();
  console.log("=== tools/list (remote HTTP) ===");
  console.log(tools.tools.map((t) => t.name).join(", "));

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

  show("list_today_schedule", await client.callTool({ name: "list_today_schedule", arguments: {} }));

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

  console.log(`\n=== terminateSession (Mcp-Session-Id: ${transport.sessionId}) ===`);
  await transport.terminateSession();
  console.log("DELETE 전송 완료 — 서버 sessions Map에서 정리됐는지는 서버 로그로 확인");

  await client.close();
}

main().catch((err) => {
  console.error("Remote MCP HTTP 검증 실패:", err);
  process.exit(1);
});
