import type { FamilyShareMessage, PreparationChecklist } from "./types.js";

export interface MakeFamilyShareMessageInput {
  checklist: PreparationChecklist;
  child_name?: string;
}

function formatKoreanDate(iso: string | null): string | null {
  if (!iso || iso === "[미확인]") return null;
  const [, m, d] = iso.split("-").map(Number);
  return `${m}월 ${d}일`;
}

function formatKoreanTime(hhmm: string | null): string | null {
  if (!hhmm) return null;
  const [hStr, mStr] = hhmm.split(":");
  const h = Number(hStr);
  const m = Number(mStr);
  const period = h < 12 ? "오전" : "오후";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${period} ${hour12}시` : `${period} ${hour12}시 ${m}분`;
}

function formatDueDate(iso: string | null): string {
  const formatted = formatKoreanDate(iso);
  return formatted ? `${formatted}까지` : "마감일 확인 필요";
}

export function makeFamilyShareMessage(input: MakeFamilyShareMessageInput): FamilyShareMessage {
  const { checklist, child_name } = input;
  const namePrefix = child_name ? `${child_name} ` : "";

  const prepareItems = checklist.check_items.filter((i) => i.type === "prepare");
  const submitItems = checklist.check_items.filter((i) => i.type === "submit");
  const hasReview = checklist.review_items.length > 0;

  const lines: string[] = [];

  if (hasReview) {
    lines.push("[확인 필요]");
    for (const item of checklist.review_items) {
      lines.push(`- ${item.label}${item.review_reason ? ` (${item.review_reason})` : ""}`);
    }
    lines.push("");
  }

  lines.push(`${namePrefix}${checklist.event_summary.title} 준비사항 정리했어.`);
  lines.push("");

  const dateStr = formatKoreanDate(checklist.event_summary.date);
  const timeStr = formatKoreanTime(checklist.event_summary.time);
  if (dateStr || timeStr) {
    lines.push(`일정: ${[dateStr, timeStr].filter(Boolean).join(" ")}`);
  }
  if (checklist.event_summary.location) {
    lines.push(`장소: ${checklist.event_summary.location}`);
  }
  lines.push("");

  if (prepareItems.length > 0) {
    lines.push("챙길 것");
    for (const item of prepareItems) {
      lines.push(`- ${item.label.replace(/\s*준비$/, "")}`);
    }
    lines.push("");
  }

  if (submitItems.length > 0) {
    lines.push("제출할 것");
    for (const item of submitItems) {
      lines.push(`- ${item.label.replace(/\s*제출$/, "")}: ${formatDueDate(item.due_date)}`);
    }
    lines.push("");
  }

  lines.push("전날 한 번 더 확인하면 됨.");

  return {
    share_message: lines.join("\n").trim(),
    message_type: "family_room_notice",
    needs_review: hasReview,
    review_reason: hasReview
      ? checklist.review_items
          .map((i) => i.review_reason)
          .filter((r): r is string => Boolean(r))
          .join("; ") || null
      : null,
  };
}
