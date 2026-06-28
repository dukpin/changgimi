import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { extractNoticeItems } from "../src/extractNotice.js";
import { createPreparationChecklist } from "../src/checklist.js";
import { makeFamilyShareMessage } from "../src/shareMessage.js";
import { createReminderPlan } from "../src/reminderPlan.js";

function loadSample(name: string): string {
  return readFileSync(join(__dirname, "..", "samples", "notices", name), "utf-8");
}

describe("full pipeline: 체험학습 안내문 (성공 케이스 1)", () => {
  const notice = extractNoticeItems({
    source_type: "image_ocr_text",
    notice_text: loadSample("field-trip.txt"),
  });
  const checklist = createPreparationChecklist({ extracted_notice: notice, child_name: "민준" });

  it("준비물 due_date는 행사 전날", () => {
    const prep = checklist.check_items.filter((i) => i.type === "prepare");
    expect(prep).toHaveLength(4);
    for (const item of prep) {
      expect(item.due_date).toBe("2026-07-09");
      expect(item.needs_review).toBe(false);
    }
  });

  it("제출물 due_date는 원문 마감일", () => {
    const submit = checklist.check_items.filter((i) => i.type === "submit");
    expect(submit).toHaveLength(1);
    expect(submit[0].due_date).toBe("2026-07-03");
  });

  it("review_items는 비어 있음", () => {
    expect(checklist.review_items).toHaveLength(0);
  });

  it("가족방 공유문에 일정/장소/챙길 것/제출할 것이 모두 포함됨", () => {
    const message = makeFamilyShareMessage({ checklist, child_name: "민준" });
    expect(message.needs_review).toBe(false);
    expect(message.share_message).toContain("민준 체험학습 준비사항 정리했어.");
    expect(message.share_message).toContain("일정: 7월 10일 오전 8시 40분");
    expect(message.share_message).toContain("장소: 국립과천과학관");
    expect(message.share_message).toContain("챙길 것");
    expect(message.share_message).toContain("- 도시락");
    expect(message.share_message).toContain("제출할 것");
    expect(message.share_message).toContain("- 참가동의서: 7월 3일까지");
  });

  it("알림 후보가 기준표대로 4건 생성됨", () => {
    const plan = createReminderPlan({ extracted_notice: notice });
    expect(plan.needs_review).toBe(false);
    expect(plan.reminders).toHaveLength(4);
    const byKind = Object.fromEntries(plan.reminders.map((r) => [r.kind, r.fire_at]));
    expect(byKind.submission_due_day_before).toBe("2026-07-02T21:00:00+09:00");
    expect(byKind.submission_due_day_of).toBe("2026-07-03T07:30:00+09:00");
    expect(byKind.event_prep_day_before).toBe("2026-07-09T21:00:00+09:00");
    expect(byKind.event_check_day_of).toBe("2026-07-10T07:30:00+09:00");
  });
});

describe("full pipeline: 미술 준비물 공지 (성공 케이스 2)", () => {
  const notice = extractNoticeItems({
    source_type: "image_ocr_text",
    notice_text: loadSample("art-supplies.txt"),
  });
  const checklist = createPreparationChecklist({ extracted_notice: notice });

  it("당일 알림 없이 전날 21시 알림만 생성", () => {
    const plan = createReminderPlan({ extracted_notice: notice });
    expect(plan.reminders).toHaveLength(1);
    expect(plan.reminders[0].kind).toBe("event_prep_day_before");
    expect(plan.reminders[0].fire_at).toBe("2026-07-05T21:00:00+09:00");
  });

  it("review_items 없음", () => {
    expect(checklist.review_items).toHaveLength(0);
  });
});

describe("full pipeline: 확인필요/실패방어 케이스", () => {
  it("학급 발표회: 공유문 상단에 확인 필요 표시", () => {
    const notice = extractNoticeItems({
      source_type: "image_ocr_text",
      notice_text: loadSample("class-performance.txt"),
    });
    const checklist = createPreparationChecklist({ extracted_notice: notice });
    const message = makeFamilyShareMessage({ checklist });
    expect(checklist.review_items.length).toBeGreaterThan(0);
    expect(message.needs_review).toBe(true);
    expect(message.share_message.startsWith("[확인 필요]")).toBe(true);
  });

  it("날짜 없음: 알림 생성 안 함, needs_review=true", () => {
    const notice = extractNoticeItems({
      source_type: "image_ocr_text",
      notice_text: loadSample("missing-date.txt"),
    });
    const plan = createReminderPlan({ extracted_notice: notice });
    expect(plan.reminders).toHaveLength(0);
    expect(plan.needs_review).toBe(true);
  });

  it("OCR 깨짐: 추정 항목이 review_items로 분류됨", () => {
    const notice = extractNoticeItems({
      source_type: "image_ocr_text",
      notice_text: loadSample("ocr-broken.txt"),
    });
    const checklist = createPreparationChecklist({ extracted_notice: notice });
    expect(checklist.review_items.length).toBeGreaterThan(0);
    expect(checklist.check_items).toHaveLength(0);
  });
});
