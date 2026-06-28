#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { extractNoticeItems } from "./extractNotice.js";
import { createPreparationChecklist } from "./checklist.js";
import { makeFamilyShareMessage } from "./shareMessage.js";
import { createReminderPlan } from "./reminderPlan.js";
import type { ExtractedNotice, PreparationChecklist } from "./types.js";

const server = new McpServer({
  name: "changgim-assistant",
  version: "0.1.0",
});

function jsonResult(payload: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
  };
}

server.registerTool(
  "extract_notice_items",
  {
    title: "안내문 항목 추출",
    description: "안내문(사진 OCR 텍스트)에서 일정/장소/준비물/제출물을 추출합니다.",
    inputSchema: {
      source_type: z.enum(["image_ocr_text", "text"]),
      notice_text: z.string(),
      received_at: z.string().optional(),
      timezone: z.string().optional(),
    },
  },
  async (input) => jsonResult(extractNoticeItems(input)),
);

const extractedNoticeSchema = z.object({
  event_title: z.string(),
  event_type: z.enum(["field_trip", "school_notice", "performance", "meeting", "other"]),
  event_type_label: z.string(),
  event_date: z.string().nullable(),
  event_time: z.string().nullable(),
  location: z.string().nullable(),
  items_to_prepare: z.array(
    z.object({
      item: z.string(),
      category: z.string(),
      source_text: z.string(),
      evidence_type: z.enum(["explicit", "inferred", "missing"]),
      confidence_level: z.enum(["high", "medium", "low"]),
      needs_review: z.boolean(),
      review_reason: z.string().nullable(),
    }),
  ),
  submission_items: z.array(
    z.object({
      item: z.string(),
      due_date: z.string().nullable(),
      source_text: z.string(),
      evidence_type: z.enum(["explicit", "inferred", "missing"]),
      confidence_level: z.enum(["high", "medium", "low"]),
      needs_review: z.boolean(),
      review_reason: z.string().nullable(),
    }),
  ),
  notes: z.array(z.string()),
  overall_confidence_level: z.enum(["high", "medium", "low"]),
  needs_review: z.boolean(),
  review_reason: z.string().nullable(),
}) satisfies z.ZodType<ExtractedNotice>;

server.registerTool(
  "create_preparation_checklist",
  {
    title: "준비 체크리스트 생성",
    description: "추출된 안내문 정보를 실행 가능한 체크리스트로 변환합니다.",
    inputSchema: {
      extracted_notice: extractedNoticeSchema,
      child_name: z.string().optional(),
    },
  },
  async (input) => jsonResult(createPreparationChecklist(input)),
);

const checkItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  type: z.enum(["prepare", "submit"]),
  due_date: z.string().nullable(),
  status: z.enum(["todo", "done"]),
  source: z.literal("notice"),
  needs_review: z.boolean(),
  review_reason: z.string().nullable(),
});

const checklistSchema = z.object({
  checklist_title: z.string(),
  event_summary: z.object({
    title: z.string(),
    date: z.string().nullable(),
    time: z.string().nullable(),
    location: z.string().nullable(),
  }),
  check_items: z.array(checkItemSchema),
  review_items: z.array(checkItemSchema),
  overall_status: z.enum(["todo", "done"]),
}) satisfies z.ZodType<PreparationChecklist>;

server.registerTool(
  "make_family_share_message",
  {
    title: "가족방 공유 메시지 생성",
    description: "체크리스트를 가족방 공유용 메시지로 변환합니다.",
    inputSchema: {
      checklist: checklistSchema,
      child_name: z.string().optional(),
    },
  },
  async (input) => jsonResult(makeFamilyShareMessage(input)),
);

server.registerTool(
  "create_reminder_plan",
  {
    title: "알림 계획 생성",
    description: "고정 기준표에 따라 전날/당일 알림 후보 목록을 생성합니다 (실제 발송 없음).",
    inputSchema: {
      extracted_notice: extractedNoticeSchema,
    },
  },
  async (input) => jsonResult(createReminderPlan(input)),
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("챙김비서 MCP 서버 시작 실패:", error);
  process.exit(1);
});
