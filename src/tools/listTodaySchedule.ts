import { todayIsoKst } from "../dateUtils.js";
import type { ChaeggimiStore } from "../store.js";
import type { TimeSlot } from "../types.js";

export interface ListTodayScheduleInput {
  user_id: string;
  date?: string;
}

const SLOT_ORDER: TimeSlot[] = ["아침", "점심", "저녁"];

export function listTodaySchedule(store: ChaeggimiStore, input: ListTodayScheduleInput) {
  const date = input.date ?? todayIsoKst();

  const appointments = store.listAppointmentsByDate(input.user_id, date).map((a) => ({
    appointment_id: a.appointment_id,
    hospital_name: a.hospital_name,
    time: a.appointment_at.slice(11, 16),
    department: a.department,
  }));

  const medications = store
    .listMedications(input.user_id)
    .flatMap((m) =>
      SLOT_ORDER.filter((slot) => m.time_slots.includes(slot)).map((slot) => {
        const log = store.getMedicationLog(m.medication_id, date, slot);
        return {
          medication_id: m.medication_id,
          name: m.medication_name,
          time_slot: slot,
          taken: log?.taken ?? false,
        };
      }),
    );

  if (appointments.length === 0 && medications.length === 0) {
    return {
      status: "empty" as const,
      date,
      appointments,
      medications,
      summary_message: "오늘은 등록된 병원/약 일정이 없어요.",
    };
  }

  const parts: string[] = [];
  for (const appt of appointments) {
    parts.push(`오늘 ${appt.time} ${appt.hospital_name} 예약 있어요.`);
  }
  for (const med of medications) {
    parts.push(`${med.time_slot} ${med.name}은 ${med.taken ? "드셨어요" : "아직이에요"}.`);
  }

  return {
    status: "ok" as const,
    date,
    appointments,
    medications,
    summary_message: parts.join(" "),
  };
}
