import { todayIsoKst } from "../dateUtils.js";
import type { ChaeggimiStore } from "../store.js";

export interface GenerateShareSummaryInput {
  user_id: string;
  scope: "today" | "upcoming_appointment" | "specific_appointment";
  appointment_id?: string;
  owner_label?: string;
}

// "저" + 주격조사는 "제가"로 축약된다. 그 외 라벨(예: "엄마")은 받침 유무로 "이/가"를 고른다.
function withSubjectParticle(label: string): string {
  if (label === "저") return "제가";
  const lastChar = label.charCodeAt(label.length - 1);
  const hasFinalConsonant = (lastChar - 0xac00) % 28 !== 0;
  return `${label}${hasFinalConsonant ? "이" : "가"}`;
}

function formatAppointmentText(ownerLabel: string, hospitalName: string, isoDateTime: string): string {
  const [datePart, timePart] = isoDateTime.split("T");
  const [, month, day] = datePart.split("-");
  const weekday = ["일", "월", "화", "수", "목", "금", "토"][new Date(`${datePart}T00:00:00+09:00`).getDay()];
  const [hh, mm] = timePart.slice(0, 5).split(":").map(Number);
  const meridiem = hh < 12 ? "오전" : "오후";
  const hour12 = hh % 12 === 0 ? 12 : hh % 12;
  const timeLabel = mm === 0 ? `${meridiem} ${hour12}시` : `${meridiem} ${hour12}시 ${mm}분`;
  return `${withSubjectParticle(ownerLabel)} ${Number(month)}월 ${Number(day)}일(${weekday}) ${timeLabel} ${hospitalName} 예약이 있어요.`;
}

export function generateShareSummary(store: ChaeggimiStore, input: GenerateShareSummaryInput) {
  const ownerLabel = input.owner_label ?? "저";

  let appointment;
  if (input.scope === "specific_appointment" && input.appointment_id) {
    appointment = store.getAppointmentById(input.appointment_id);
  } else {
    appointment = store.getUpcomingAppointment(input.user_id);
  }

  if (!appointment) {
    return {
      status: "empty" as const,
      summary_text: `${withSubjectParticle(ownerLabel)} 등록한 병원 예약이 아직 없어요.`,
      share_method: "copy_paste" as const,
      instruction: "이 문구를 복사해서 직접 전달하시면 돼요.",
    };
  }

  const summaryText = formatAppointmentText(ownerLabel, appointment.hospital_name, appointment.appointment_at);

  return {
    status: "ok" as const,
    summary_text: summaryText,
    share_method: "copy_paste" as const,
    instruction: "이 문구를 복사해서 직접 전달하시면 돼요.",
  };
}
