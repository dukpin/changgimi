import type { ChaeggimiStore } from "../store.js";
import type { ShareScopeValue } from "../types.js";

export interface UpdateShareScopeInput {
  user_id: string;
  recipient_label: string;
  action: "enable" | "disable";
  scope?: ShareScopeValue;
}

export function updateShareScope(store: ChaeggimiStore, input: UpdateShareScopeInput) {
  if (!input.recipient_label.trim()) {
    return {
      status: "need_clarification" as const,
      reason: "missing_recipient",
      ask_message: "누구에게 공유할지 말씀해주시겠어요?",
    };
  }

  const enabled = input.action === "enable";
  store.upsertShareScope({
    user_id: input.user_id,
    recipient_label: input.recipient_label,
    scope: input.scope ?? "all",
    enabled,
  });

  const verb = enabled ? "켜놨어요" : "꺼놨어요";
  return {
    status: "ok" as const,
    // 가족 OAuth 직접 발송은 이번 MVP 범위 밖 — 항상 공유문 생성(summary_only)으로만 처리
    delivery_method: "summary_only" as const,
    confirm_message: `${input.recipient_label}한테 공유, ${verb}.`,
  };
}
