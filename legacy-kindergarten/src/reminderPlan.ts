import type { ExtractedNotice, ReminderCandidate, ReminderPlan } from "./types.js";
import { addDaysIso, combineDateTime } from "./dateUtils.js";

export interface CreateReminderPlanInput {
  extracted_notice: ExtractedNotice;
}

function isValidIsoDate(date: string | null): date is string {
  return Boolean(date) && date !== "[미확인]";
}

export function createReminderPlan(input: CreateReminderPlanInput): ReminderPlan {
  const notice = input.extracted_notice;
  const reminders: ReminderCandidate[] = [];
  const reasons: string[] = [];
  let needsReview = false;

  if (isValidIsoDate(notice.event_date)) {
    const dayBefore = addDaysIso(notice.event_date, -1);
    reminders.push({
      kind: "event_prep_day_before",
      label: `${notice.event_title} 전날 준비물 체크`,
      fire_at: combineDateTime(dayBefore, "21:00"),
      related_item: null,
    });
    if (notice.event_time) {
      reminders.push({
        kind: "event_check_day_of",
        label: `${notice.event_title} 당일 아침 체크`,
        fire_at: combineDateTime(notice.event_date, "07:30"),
        related_item: null,
      });
    }
  } else {
    needsReview = true;
    reasons.push("행사 날짜가 불명확하여 행사 알림을 생성하지 않음");
  }

  for (const submission of notice.submission_items) {
    if (isValidIsoDate(submission.due_date)) {
      const dayBefore = addDaysIso(submission.due_date, -1);
      reminders.push({
        kind: "submission_due_day_before",
        label: `${submission.item} 마감 전날`,
        fire_at: combineDateTime(dayBefore, "21:00"),
        related_item: submission.item,
      });
      reminders.push({
        kind: "submission_due_day_of",
        label: `${submission.item} 마감 당일`,
        fire_at: combineDateTime(submission.due_date, "07:30"),
        related_item: submission.item,
      });
    } else {
      needsReview = true;
      reasons.push(`${submission.item}의 제출 마감일이 불명확하여 알림을 생성하지 않음`);
    }
  }

  return {
    reminders,
    needs_review: needsReview,
    review_reason: reasons.length > 0 ? reasons.join("; ") : null,
  };
}
