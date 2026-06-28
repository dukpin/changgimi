export type EvidenceType = "explicit" | "inferred" | "missing";
export type ConfidenceLevel = "high" | "medium" | "low";
export type EventType = "field_trip" | "school_notice" | "performance" | "meeting" | "other";

export interface ReviewFields {
  evidence_type: EvidenceType;
  confidence_level: ConfidenceLevel;
  needs_review: boolean;
  review_reason: string | null;
}

export interface PrepItem extends ReviewFields {
  item: string;
  category: string;
  source_text: string;
}

export interface SubmissionItem extends ReviewFields {
  item: string;
  due_date: string | null;
  source_text: string;
}

export interface ExtractedNotice {
  event_title: string;
  event_type: EventType;
  event_type_label: string;
  event_date: string | null;
  event_time: string | null;
  location: string | null;
  items_to_prepare: PrepItem[];
  submission_items: SubmissionItem[];
  notes: string[];
  overall_confidence_level: ConfidenceLevel;
  needs_review: boolean;
  review_reason: string | null;
}

export type CheckItemType = "prepare" | "submit";
export type CheckItemStatus = "todo" | "done";

export interface CheckItem {
  id: string;
  label: string;
  type: CheckItemType;
  due_date: string | null;
  status: CheckItemStatus;
  source: "notice";
  needs_review: boolean;
  review_reason: string | null;
}

export interface EventSummary {
  title: string;
  date: string | null;
  time: string | null;
  location: string | null;
}

export interface PreparationChecklist {
  checklist_title: string;
  event_summary: EventSummary;
  check_items: CheckItem[];
  review_items: CheckItem[];
  overall_status: "todo" | "done";
}

export interface FamilyShareMessage {
  share_message: string;
  message_type: "family_room_notice";
  needs_review: boolean;
  review_reason: string | null;
}

export type ReminderKind =
  | "submission_due_day_before"
  | "submission_due_day_of"
  | "event_prep_day_before"
  | "event_check_day_of";

export interface ReminderCandidate {
  kind: ReminderKind;
  label: string;
  fire_at: string;
  related_item: string | null;
}

export interface ReminderPlan {
  reminders: ReminderCandidate[];
  needs_review: boolean;
  review_reason: string | null;
}
