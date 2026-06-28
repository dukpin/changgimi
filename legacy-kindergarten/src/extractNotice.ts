import type {
  ConfidenceLevel,
  EventType,
  ExtractedNotice,
  PrepItem,
  SubmissionItem,
} from "./types.js";
import { toIsoDate } from "./dateUtils.js";

export interface ExtractNoticeInput {
  source_type: "image_ocr_text" | "text";
  notice_text: string;
  received_at?: string;
  timezone?: string;
}

const KNOWN_ITEM_LEXICON = [
  "도시락",
  "물",
  "모자",
  "운동화",
  "돗자리",
  "개인 돗자리",
  "우산",
  "책",
  "공책",
  "연필",
  "색종이",
  "풀",
  "가위",
  "안전가위",
  "잡지나 신문지 1부",
  "A4 파일",
  "리코더",
  "악보 파일",
];

const FOOD_KEYWORDS = ["도시락", "물", "간식", "물병"];
const GEAR_KEYWORDS = ["모자", "운동화", "돗자리", "우산", "옷", "신발"];
const SUPPLY_KEYWORDS = [
  "색종이",
  "풀",
  "가위",
  "파일",
  "리코더",
  "악보",
  "책",
  "공책",
  "연필",
  "신문지",
  "잡지",
];

function categorize(item: string): string {
  if (FOOD_KEYWORDS.some((k) => item.includes(k))) return "food";
  if (GEAR_KEYWORDS.some((k) => item.includes(k))) return "gear";
  if (SUPPLY_KEYWORDS.some((k) => item.includes(k))) return "supplies";
  return "other";
}

function findBracketTitle(text: string): string | null {
  const match = text.match(/\[(.+?)\]/);
  return match ? match[1].trim() : null;
}

function classifyEvent(rawTitle: string | null, text: string): { event_type: EventType; event_type_label: string; event_title: string } {
  const source = `${rawTitle ?? ""} ${text}`;
  if (source.includes("체험학습")) {
    return { event_type: "field_trip", event_type_label: "체험학습", event_title: "체험학습" };
  }
  if (source.includes("발표회")) {
    return { event_type: "performance", event_type_label: "학급 발표회", event_title: "학급 발표회" };
  }
  if (source.includes("준비물")) {
    const label = rawTitle?.replace(/\s*안내\s*$/, "").trim() || "준비물 안내";
    return { event_type: "school_notice", event_type_label: label, event_title: label };
  }
  const label = rawTitle?.replace(/\s*안내\s*$/, "").trim() || "학교 안내";
  return { event_type: "other", event_type_label: label, event_title: label };
}

interface DateParseResult {
  isoDate: string | null;
  broken: boolean;
  relative: boolean;
}

function parseExplicitDate(text: string): DateParseResult {
  const match = text.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
  if (match) {
    const [, y, m, d] = match;
    return { isoDate: toIsoDate(Number(y), Number(m), Number(d)), broken: false, relative: false };
  }
  const brokenMatch = text.match(/(\d{4})년\s*(\d{1,2})월\s*\??일/);
  if (brokenMatch) {
    return { isoDate: null, broken: true, relative: false };
  }
  const relativeMatch = text.match(/(이번\s*주|다음\s*주)\s*[월화수목금토일]요일/);
  if (relativeMatch) {
    return { isoDate: null, broken: false, relative: true };
  }
  return { isoDate: null, broken: false, relative: false };
}

interface TimeParseResult {
  hhmm: string | null;
  broken: boolean;
}

function parseExplicitTime(text: string): TimeParseResult {
  const brokenMatch = text.match(/(오전|오후)\s*(\d{1,2})시\s*\?+\s*\d*\s*분?/);
  if (brokenMatch) {
    return { hhmm: null, broken: true };
  }
  const match = text.match(/(오전|오후)\s*(\d{1,2})시\s*(\d{1,2})?\s*분?/);
  if (match) {
    const [, period, hourStr, minuteStr] = match;
    let hour = Number(hourStr);
    const minute = minuteStr ? Number(minuteStr) : 0;
    if (period === "오후" && hour < 12) hour += 12;
    return { hhmm: `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`, broken: false };
  }
  return { hhmm: null, broken: false };
}

function parseLocation(text: string): { location: string | null; broken: boolean } {
  const match = text.match(/장소\s*[:：]\s*(.+)/);
  if (!match) return { location: null, broken: false };
  const location = match[1].trim();
  return { location, broken: location.includes("?") };
}

function splitItemList(raw: string): string[] {
  return raw
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => s.replace(/^및\s*/, ""));
}

function resolveBrokenItem(token: string): { item: string; matched: boolean } {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\\\?/g, ".");
  const pattern = new RegExp(`^${escaped}$`);
  for (const candidate of KNOWN_ITEM_LEXICON) {
    if (candidate.length === token.length && pattern.test(candidate)) {
      return { item: candidate, matched: true };
    }
  }
  return { item: "[미확인 항목]", matched: false };
}

function buildPrepItems(rawTokens: string[]): PrepItem[] {
  return rawTokens.map((token) => {
    if (token.includes("?")) {
      const { item, matched } = resolveBrokenItem(token);
      return {
        item,
        category: categorize(item),
        source_text: token,
        evidence_type: matched ? "inferred" : "missing",
        confidence_level: "low",
        needs_review: true,
        review_reason: matched ? "OCR 깨짐으로 추정값" : "OCR 깨짐으로 항목 식별 불가",
      };
    }
    return {
      item: token,
      category: categorize(token),
      source_text: token,
      evidence_type: "explicit",
      confidence_level: "high",
      needs_review: false,
      review_reason: null,
    };
  });
}

function extractPrepItemTokens(text: string): string[] {
  const labeledMatch = text.match(/준비물\s*[:：][ \t]*([^\n]*)/);
  if (labeledMatch) {
    const inline = labeledMatch[1].trim();
    if (inline.length > 0) {
      return splitItemList(inline);
    }
    const lines = text.split("\n");
    const startIdx = lines.findIndex((l) => /준비물\s*[:：]/.test(l));
    const bulletItems: string[] = [];
    for (let i = startIdx + 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith("-")) {
        bulletItems.push(line.replace(/^-\s*/, "").trim());
      } else if (line.length === 0) {
        continue;
      } else {
        break;
      }
    }
    return bulletItems;
  }
  const sentenceMatch = text.match(/([가-힣A-Za-z0-9,\s]+?)\s*(?:을|를)?\s*준비해\s*주세요/);
  if (sentenceMatch) {
    let clause = sentenceMatch[1];
    const clauseBoundary = /(에는|에서는|때는)/g;
    let lastBoundaryEnd = -1;
    let boundaryMatch: RegExpExecArray | null;
    while ((boundaryMatch = clauseBoundary.exec(clause)) !== null) {
      lastBoundaryEnd = boundaryMatch.index + boundaryMatch[0].length;
    }
    if (lastBoundaryEnd >= 0) {
      clause = clause.slice(lastBoundaryEnd);
    }
    return splitItemList(clause);
  }
  return [];
}

function extractSubmissionItems(text: string): SubmissionItem[] {
  const submissionMatch = text.match(/제출물\s*[:：]\s*([^\n]+)/);
  if (!submissionMatch) return [];
  const items = splitItemList(submissionMatch[1]);
  const dueDateMatch = text.match(/제출기한\s*[:：]\s*(.+)/);
  let dueDate: string | null = null;
  let dueBroken = false;
  if (dueDateMatch) {
    const parsed = parseExplicitDate(dueDateMatch[1]);
    dueDate = parsed.isoDate;
    dueBroken = parsed.broken;
  }
  return items.map((item) => {
    if (!dueDateMatch || dueDate === null) {
      return {
        item,
        due_date: null,
        source_text: submissionMatch[0],
        evidence_type: dueDateMatch ? "missing" : "missing",
        confidence_level: "low",
        needs_review: true,
        review_reason: dueBroken ? "제출 마감일 OCR 깨짐" : "제출물이 있으나 마감일이 없음",
      };
    }
    return {
      item,
      due_date: dueDate,
      source_text: `${submissionMatch[0]} / ${dueDateMatch[0]}`,
      evidence_type: "explicit",
      confidence_level: "high",
      needs_review: false,
      review_reason: null,
    };
  });
}

const VAGUE_PHRASES = ["추후 안내", "별도 안내", "미정"];

export function extractNoticeItems(input: ExtractNoticeInput): ExtractedNotice {
  const text = input.notice_text;
  const rawTitle = findBracketTitle(text);
  const { event_type, event_type_label, event_title } = classifyEvent(rawTitle, text);

  const dateResult = parseExplicitDate(text);
  const timeResult = parseExplicitTime(text);
  const locationResult = parseLocation(text);
  const prepItems = buildPrepItems(extractPrepItemTokens(text));
  const submissionItems = extractSubmissionItems(text);

  const reasons: string[] = [];
  let needsReview = false;
  let eventDate: string | null = dateResult.isoDate;

  if (dateResult.relative) {
    eventDate = "[미확인]";
    needsReview = true;
    reasons.push("상대 날짜 표현은 수신일 기준 변환 필요");
  } else if (dateResult.broken) {
    needsReview = true;
    reasons.push("일정 날짜 OCR 깨짐");
  } else if (!dateResult.isoDate) {
    needsReview = true;
    reasons.push("준비일 또는 수업일이 명시되지 않음");
  }

  if (timeResult.broken) {
    needsReview = true;
    reasons.push("행사 시간 OCR 깨짐");
  } else if (!timeResult.hhmm && (event_type === "field_trip" || event_type === "performance")) {
    needsReview = true;
    reasons.push("행사 시작 시간이 명시되지 않음");
  }

  if (locationResult.broken) {
    needsReview = true;
    reasons.push("장소 OCR 깨짐 가능");
  } else if (!locationResult.location && event_type === "field_trip") {
    needsReview = true;
    reasons.push("체험학습/행사인데 장소가 없음");
  }

  for (const phrase of VAGUE_PHRASES) {
    if (text.includes(phrase)) {
      needsReview = true;
      reasons.push(`'${phrase}' 표현 포함`);
    }
  }

  const hasOcrIssue = prepItems.some((p) => p.needs_review) || submissionItems.some((s) => s.needs_review);
  if (hasOcrIssue) needsReview = true;

  let overallConfidence: ConfidenceLevel = "high";
  if (
    dateResult.broken ||
    timeResult.broken ||
    locationResult.broken ||
    prepItems.some((p) => p.confidence_level === "low") ||
    submissionItems.some((s) => s.confidence_level === "low")
  ) {
    overallConfidence = "low";
  } else if (needsReview) {
    overallConfidence = "medium";
  }

  const dedupedReasons = Array.from(new Set(reasons));

  return {
    event_title,
    event_type,
    event_type_label,
    event_date: eventDate,
    event_time: timeResult.hhmm,
    location: locationResult.location,
    items_to_prepare: prepItems,
    submission_items: submissionItems,
    notes: [],
    overall_confidence_level: overallConfidence,
    needs_review: needsReview,
    review_reason: dedupedReasons.length > 0 ? dedupedReasons.join("; ") : null,
  };
}
