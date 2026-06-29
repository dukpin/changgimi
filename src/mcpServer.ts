import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ChaeggimiStore } from "./store.js";
import { addHospitalAppointment } from "./tools/addHospitalAppointment.js";
import { listTodaySchedule } from "./tools/listTodaySchedule.js";
import { addMedicationText } from "./tools/addMedicationText.js";
import { markMedicationTaken } from "./tools/markMedicationTaken.js";
import { generateShareSummary } from "./tools/generateShareSummary.js";
import { updateShareScope } from "./tools/updateShareScope.js";

// PlayMCP/Kakao Tools 인증 레이어가 실제 user_id를 주입하기 전까지는
// 데모 고정 사용자로 동작한다. 인증 연동 시 이 상수 대신 컨텍스트에서 받는다.
//
// 참고: 이 상수 자체는 "같은 store 안에서" 모든 호출을 한 사용자로 취급한다는
// 뜻일 뿐이다. HTTP remote endpoint(src/httpServer.ts)는 MCP 세션(Mcp-Session-Id)
// 단위로 별도의 store(=createChaeggimiServer 호출)를 만들기 때문에, 서로 다른
// 세션(접속자)끼리는 DEMO_USER_ID가 같아도 데이터가 섞이지 않는다. 한 세션
// 안에서 여러 tool 호출이 같은 사용자로 이어지는 것만 보장하면 되므로 충분하다.
// 다중 사용자 영속 데이터(세션이 끝나도 유지)가 필요해지면 그때 실제 user_id +
// Supabase로 교체한다.
const DEMO_USER_ID = "demo-user";

function jsonResult(payload: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
  };
}

const timeSlotSchema = z.enum(["아침", "점심", "저녁"]);

/**
 * stdio/HTTP 두 entry point가 공유하는 McpServer 인스턴스를 만든다.
 * tool 6개 등록 로직은 여기 한 곳에만 둔다 — entry point는 transport 연결만 책임진다.
 *
 * store는 호출하는 쪽에서 주입한다. HTTP stateless 모드는 "요청마다 새
 * transport(+서버)를 만들어야" 하는데, 그렇다고 store까지 매 요청 새로 만들면
 * 등록한 예약/약이 다음 요청에서 사라진다. 그래서 store는 entry point에서
 * 한 번만 만들어 계속 재사용하고, 이 함수는 호출될 때마다 새 McpServer에
 * 그 store를 연결만 한다.
 */
export function createChaeggimiServer(store: ChaeggimiStore): McpServer {
  const server = new McpServer({
    name: "changgim-assistant",
    version: "0.2.0",
  });

  server.registerTool(
    "add_hospital_appointment",
    {
      title: "병원 예약 등록",
      description: "병원 예약을 음성/텍스트 자연어로 등록합니다.",
      inputSchema: {
        hospital_name: z.string(),
        datetime_text: z.string(),
        department: z.string().optional(),
        memo: z.string().max(50).optional(),
      },
    },
    async (input) => jsonResult(addHospitalAppointment(store, { user_id: DEMO_USER_ID, ...input })),
  );

  server.registerTool(
    "list_today_schedule",
    {
      title: "오늘 일정 한눈에 보기",
      description: "오늘의 병원 예약과 복약 상태를 함께 조회합니다.",
      inputSchema: {
        date: z.string().optional(),
      },
    },
    async (input) => jsonResult(listTodaySchedule(store, { user_id: DEMO_USER_ID, ...input })),
  );

  server.registerTool(
    "add_medication_text",
    {
      title: "약 등록 (텍스트)",
      description: "약 이름, 복용 시간대, 식전/식후를 텍스트로 등록합니다.",
      inputSchema: {
        medication_name: z.string(),
        time_slots: z.array(timeSlotSchema).min(1),
        timing: z.enum(["식전", "식후"]),
        raw_caution_text: z.string().optional(),
      },
    },
    async (input) => jsonResult(addMedicationText(store, { user_id: DEMO_USER_ID, ...input })),
  );

  server.registerTool(
    "mark_medication_taken",
    {
      title: "복약 완료 처리",
      description: "약을 먹었는지/안 먹었는지 표시합니다. 이름 없이 시간대만 말해도 자동 매칭합니다.",
      inputSchema: {
        medication_id: z.string().optional(),
        medication_name: z.string().optional(),
        time_slot: timeSlotSchema,
        taken: z.boolean(),
        date: z.string().optional(),
      },
    },
    async (input) => jsonResult(markMedicationTaken(store, { user_id: DEMO_USER_ID, ...input })),
  );

  server.registerTool(
    "generate_share_summary",
    {
      title: "가족 공유문 생성",
      description: "가족에게 복사해서 전달할 수 있는 공유 문구를 생성합니다 (직접 발송 아님).",
      inputSchema: {
        scope: z.enum(["today", "upcoming_appointment", "specific_appointment"]),
        appointment_id: z.string().optional(),
        owner_label: z.string().optional(),
      },
    },
    async (input) => jsonResult(generateShareSummary(store, { user_id: DEMO_USER_ID, ...input })),
  );

  server.registerTool(
    "update_share_scope",
    {
      title: "가족 공유 설정 변경",
      description: "가족 공유를 켜거나 끄고, 공유 범위를 변경합니다 (옵트인).",
      inputSchema: {
        recipient_label: z.string(),
        action: z.enum(["enable", "disable"]),
        scope: z.enum(["all", "appointment_only", "medication_only"]).optional(),
      },
    },
    async (input) => jsonResult(updateShareScope(store, { user_id: DEMO_USER_ID, ...input })),
  );

  return server;
}
