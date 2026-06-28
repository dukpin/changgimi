import type { CheckItem, EventSummary, ExtractedNotice, PreparationChecklist } from "./types.js";
import { addDaysIso } from "./dateUtils.js";

export interface CreateChecklistInput {
  extracted_notice: ExtractedNotice;
  child_name?: string;
}

function eventDueDate(notice: ExtractedNotice): string | null {
  if (!notice.event_date || notice.event_date === "[미확인]") return null;
  return addDaysIso(notice.event_date, -1);
}

export function createPreparationChecklist(input: CreateChecklistInput): PreparationChecklist {
  const { extracted_notice: notice, child_name } = input;
  const titlePrefix = child_name ? `${child_name} ` : "";
  const checklistTitle = `${titlePrefix}${notice.event_title} 준비 체크리스트`;

  const prepDueDate = eventDueDate(notice);
  const checkItems: CheckItem[] = [];
  const reviewItems: CheckItem[] = [];

  notice.items_to_prepare.forEach((prep, idx) => {
    const needsReview = prep.needs_review || prepDueDate === null;
    const item: CheckItem = {
      id: `prep_${(idx + 1).toString().padStart(3, "0")}`,
      label: `${prep.item} 준비`,
      type: "prepare",
      due_date: prepDueDate,
      status: "todo",
      source: "notice",
      needs_review: needsReview,
      review_reason: prep.needs_review
        ? prep.review_reason
        : prepDueDate === null
          ? "행사일이 없어 준비 기준일을 정할 수 없음"
          : null,
    };
    (needsReview ? reviewItems : checkItems).push(item);
  });

  notice.submission_items.forEach((sub, idx) => {
    const needsReview = sub.needs_review || sub.due_date === null;
    const item: CheckItem = {
      id: `submit_${(idx + 1).toString().padStart(3, "0")}`,
      label: `${sub.item} 제출`,
      type: "submit",
      due_date: sub.due_date,
      status: "todo",
      source: "notice",
      needs_review: needsReview,
      review_reason: sub.review_reason,
    };
    (needsReview ? reviewItems : checkItems).push(item);
  });

  const eventSummary: EventSummary = {
    title: notice.event_title,
    date: notice.event_date,
    time: notice.event_time,
    location: notice.location,
  };

  return {
    checklist_title: checklistTitle,
    event_summary: eventSummary,
    check_items: checkItems,
    review_items: reviewItems,
    overall_status: "todo",
  };
}
