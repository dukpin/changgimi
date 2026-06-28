import { combineDateTime, parseRelativeDateTime } from "../dateUtils.js";
import type { ChaeggimiStore } from "../store.js";

export interface AddHospitalAppointmentInput {
  user_id: string;
  hospital_name: string;
  datetime_text: string;
  department?: string;
  memo?: string;
}

const WEEKDAY_LABEL = ["일", "월", "화", "수", "목", "금", "토"];

function formatConfirm(isoDate: string, hhmm: string, hospitalName: string): string {
  const [, month, day] = isoDate.split("-");
  const weekday = WEEKDAY_LABEL[new Date(`${isoDate}T00:00:00+09:00`).getDay()];
  const [hh, mm] = hhmm.split(":").map(Number);
  const meridiem = hh < 12 ? "오전" : "오후";
  const hour12 = hh % 12 === 0 ? 12 : hh % 12;
  const timePart = mm === 0 ? `${meridiem} ${hour12}시` : `${meridiem} ${hour12}시 ${mm}분`;
  return `${Number(month)}월 ${Number(day)}일(${weekday}) ${timePart}, ${hospitalName} 예약 등록했어요.`;
}

export function addHospitalAppointment(store: ChaeggimiStore, input: AddHospitalAppointmentInput) {
  if (!input.hospital_name.trim()) {
    return {
      status: "need_clarification" as const,
      reason: "missing_hospital_name",
      ask_message: "병원 이름을 말씀해주시겠어요?",
    };
  }
  if (input.memo && input.memo.length > 50) {
    return {
      status: "need_clarification" as const,
      reason: "memo_too_long",
      ask_message: "메모는 50자 이내로 짧게 말씀해주시겠어요?",
    };
  }

  const parsed = parseRelativeDateTime(input.datetime_text);
  if (!parsed.ok) {
    const askMessage =
      parsed.reason === "past_date"
        ? "이미 지난 날짜인데 맞아요? 날짜를 다시 한번 말씀해주시겠어요?"
        : parsed.reason === "ambiguous_time"
          ? "몇 시인지 다시 한번 말씀해주시겠어요?"
          : "날짜를 정확히 확인해주시겠어요?";
    return { status: "need_clarification" as const, reason: parsed.reason, ask_message: askMessage };
  }

  const resolvedDatetime = combineDateTime(parsed.isoDate, parsed.hhmm);
  const record = store.addAppointment({
    user_id: input.user_id,
    hospital_name: input.hospital_name,
    department: input.department ?? null,
    appointment_at: resolvedDatetime,
    memo: input.memo ?? null,
  });

  return {
    status: "ok" as const,
    appointment_id: record.appointment_id,
    resolved_datetime: resolvedDatetime,
    confirm_message: formatConfirm(parsed.isoDate, parsed.hhmm, input.hospital_name),
  };
}
