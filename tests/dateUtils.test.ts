import { describe, expect, it } from "vitest";
import { parseRelativeDateTime, todayIsoKst } from "../src/dateUtils.js";

const NOW = new Date("2026-06-28T01:00:00+09:00"); // KST 일요일

describe("parseRelativeDateTime", () => {
  it("내일 오전 10시를 파싱한다", () => {
    const result = parseRelativeDateTime("내일 오전 10시", NOW);
    expect(result).toEqual({ ok: true, isoDate: "2026-06-29", hhmm: "10:00" });
  });

  it("다음주 화요일 오전 10시를 파싱한다", () => {
    const result = parseRelativeDateTime("다음주 화요일 오전 10시", NOW);
    expect(result).toEqual({ ok: true, isoDate: "2026-07-07", hhmm: "10:00" });
  });

  it("날짜가 모호하면 추정하지 않고 실패를 반환한다", () => {
    const result = parseRelativeDateTime("언젠가 갈게", NOW);
    expect(result).toEqual({ ok: false, reason: "ambiguous_date" });
  });

  it("시간이 없으면 실패를 반환한다", () => {
    const result = parseRelativeDateTime("내일", NOW);
    expect(result).toEqual({ ok: false, reason: "ambiguous_time" });
  });

  it("오늘 기준 날짜를 KST로 계산한다", () => {
    expect(todayIsoKst(NOW)).toBe("2026-06-28");
  });
});
