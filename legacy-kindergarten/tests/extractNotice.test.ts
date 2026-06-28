import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { extractNoticeItems } from "../src/extractNotice.js";

function loadSample(name: string): string {
  return readFileSync(join(__dirname, "..", "samples", "notices", name), "utf-8");
}

describe("extractNoticeItems", () => {
  it("성공 케이스 1: 체험학습 안내문 — 모든 항목 explicit/high, needs_review=false", () => {
    const result = extractNoticeItems({
      source_type: "image_ocr_text",
      notice_text: loadSample("field-trip.txt"),
    });

    expect(result.event_type).toBe("field_trip");
    expect(result.event_date).toBe("2026-07-10");
    expect(result.event_time).toBe("08:40");
    expect(result.location).toBe("국립과천과학관");
    expect(result.needs_review).toBe(false);
    expect(result.overall_confidence_level).toBe("high");

    expect(result.items_to_prepare.map((i) => i.item)).toEqual(["도시락", "물", "모자", "개인 돗자리"]);
    for (const item of result.items_to_prepare) {
      expect(item.evidence_type).toBe("explicit");
      expect(item.confidence_level).toBe("high");
      expect(item.needs_review).toBe(false);
    }

    expect(result.submission_items).toHaveLength(1);
    expect(result.submission_items[0].item).toBe("참가동의서");
    expect(result.submission_items[0].due_date).toBe("2026-07-03");
    expect(result.submission_items[0].needs_review).toBe(false);
  });

  it("성공 케이스 2: 미술 준비물 공지 — 날짜/시간 없어도 needs_review=false", () => {
    const result = extractNoticeItems({
      source_type: "image_ocr_text",
      notice_text: loadSample("art-supplies.txt"),
    });

    expect(result.event_type).toBe("school_notice");
    expect(result.event_date).toBe("2026-07-06");
    expect(result.event_time).toBeNull();
    expect(result.needs_review).toBe(false);
    expect(result.items_to_prepare.map((i) => i.item)).toEqual([
      "색종이",
      "풀",
      "안전가위",
      "잡지나 신문지 1부",
      "작품을 담아갈 A4 파일",
    ]);
  });

  it("확인필요 케이스: 학급 발표회 — 상대 날짜/시작 시간 추후 안내로 needs_review=true", () => {
    const result = extractNoticeItems({
      source_type: "image_ocr_text",
      notice_text: loadSample("class-performance.txt"),
    });

    expect(result.event_type).toBe("performance");
    expect(result.event_date).toBe("[미확인]");
    expect(result.event_time).toBeNull();
    expect(result.needs_review).toBe(true);
    expect(result.review_reason).toContain("수신일 기준 변환 필요");
    expect(result.review_reason).toContain("추후 안내");
  });

  it("실패 방어 케이스 1: OCR 깨짐 — 날짜/시간/장소 needs_review, 추정 항목 inferred", () => {
    const result = extractNoticeItems({
      source_type: "image_ocr_text",
      notice_text: loadSample("ocr-broken.txt"),
    });

    expect(result.event_date).toBeNull();
    expect(result.event_time).toBeNull();
    expect(result.needs_review).toBe(true);
    expect(result.location).toContain("?");

    const guessed = result.items_to_prepare.filter((i) => i.evidence_type === "inferred");
    expect(guessed.map((i) => i.item)).toEqual(expect.arrayContaining(["모자", "운동화"]));
    for (const item of guessed) {
      expect(item.needs_review).toBe(true);
    }
  });

  it("실패 방어 케이스 2: 날짜 없음 — 준비물은 추출, 날짜 null, needs_review=true", () => {
    const result = extractNoticeItems({
      source_type: "image_ocr_text",
      notice_text: loadSample("missing-date.txt"),
    });

    expect(result.event_date).toBeNull();
    expect(result.needs_review).toBe(true);
    expect(result.review_reason).toContain("준비일 또는 수업일이 명시되지 않음");
    expect(result.items_to_prepare.map((i) => i.item)).toEqual(["색종이", "풀", "가위", "잡지"]);
  });
});
