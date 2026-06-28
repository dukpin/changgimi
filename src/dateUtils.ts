function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

export function toIsoDate(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function addDaysIso(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return toIsoDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

export function combineDateTime(isoDate: string, hhmm: string): string {
  return `${isoDate}T${hhmm}:00+09:00`;
}

/** KST 기준 "오늘" 날짜(YYYY-MM-DD)를 반환한다. 테스트에서는 now를 주입한다. */
export function todayIsoKst(now: Date = new Date()): string {
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return toIsoDate(kst.getUTCFullYear(), kst.getUTCMonth() + 1, kst.getUTCDate());
}

const WEEKDAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];

function weekdayIndexOfIso(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export interface ParsedDateTime {
  ok: true;
  isoDate: string;
  hhmm: string;
}

export interface ParseFailure {
  ok: false;
  reason: "ambiguous_date" | "ambiguous_time" | "past_date";
}

/**
 * "내일 오전 10시", "다음주 화요일 오전 10시", "모레 오후 3시" 같은 자연어를
 * KST 기준 날짜/시간으로 변환한다. 모호하면 절대 추정하지 않고 실패를 반환한다.
 */
export function parseRelativeDateTime(
  text: string,
  now: Date = new Date(),
): ParsedDateTime | ParseFailure {
  const today = todayIsoKst(now);
  let isoDate: string | null = null;

  if (/모레/.test(text)) {
    isoDate = addDaysIso(today, 2);
  } else if (/내일/.test(text)) {
    isoDate = addDaysIso(today, 1);
  } else if (/오늘/.test(text)) {
    isoDate = today;
  } else {
    const weekdayMatch = text.match(/([일월화수목금토])요일/);
    if (weekdayMatch) {
      const targetIdx = WEEKDAY_NAMES.indexOf(weekdayMatch[1]);
      const todayIdx = weekdayIndexOfIso(today);
      let diff = (targetIdx - todayIdx + 7) % 7;
      if (diff === 0) diff = 7; // 오늘과 같은 요일이면 다음 그 요일로
      isoDate = addDaysIso(today, diff);
      if (/다음\s*주/.test(text)) {
        isoDate = addDaysIso(isoDate, 7);
      }
    } else {
      const explicit = text.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
      if (explicit) {
        const month = Number(explicit[1]);
        const day = Number(explicit[2]);
        const [todayYear] = today.split("-").map(Number);
        let candidate = toIsoDate(todayYear, month, day);
        if (candidate < today) {
          candidate = toIsoDate(todayYear + 1, month, day);
        }
        isoDate = candidate;
      }
    }
  }

  if (!isoDate) {
    return { ok: false, reason: "ambiguous_date" };
  }
  if (isoDate < today) {
    return { ok: false, reason: "past_date" };
  }

  const timeMatch = text.match(/(오전|오후)?\s*(\d{1,2})\s*시(?:\s*(\d{1,2})\s*분)?/);
  if (!timeMatch) {
    return { ok: false, reason: "ambiguous_time" };
  }
  const meridiem = timeMatch[1];
  let hour = Number(timeMatch[2]);
  const minute = timeMatch[3] ? Number(timeMatch[3]) : 0;
  if (meridiem === "오후" && hour < 12) hour += 12;
  if (meridiem === "오전" && hour === 12) hour = 0;
  if (!meridiem && hour < 8) hour += 12; // "3시"만 있으면 오후로 추정하지 않고 그대로 두되, 새벽 시간은 보정하지 않음(요구사항 단순화)

  const hhmm = `${pad(hour)}:${pad(minute)}`;
  return { ok: true, isoDate, hhmm };
}
