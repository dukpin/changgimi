import { todayIsoKst } from "../dateUtils.js";
import type { ChaeggimiStore } from "../store.js";
import type { TimeSlot } from "../types.js";

export interface MarkMedicationTakenInput {
  user_id: string;
  medication_id?: string;
  medication_name?: string;
  time_slot: TimeSlot;
  taken: boolean;
  date?: string;
}

export function markMedicationTaken(store: ChaeggimiStore, input: MarkMedicationTakenInput) {
  const logDate = input.date ?? todayIsoKst();
  const label = input.taken ? "드신" : "안 드신";

  let medicationId = input.medication_id ?? null;

  if (!medicationId && input.medication_name) {
    const med = store.findMedicationByName(input.user_id, input.medication_name);
    if (!med) {
      return {
        status: "not_found" as const,
        ask_message: "그 약이 등록되어 있지 않아요. 약 이름을 다시 말씀해주실래요?",
      };
    }
    medicationId = med.medication_id;
  }

  if (!medicationId) {
    const candidates = store.listMedicationsByTimeSlot(input.user_id, input.time_slot);
    if (candidates.length === 0) {
      return {
        status: "not_found" as const,
        ask_message: "그 시간대 약이 등록되어 있지 않아요. 약 이름을 다시 말씀해주실래요?",
      };
    }
    if (candidates.length > 1) {
      const names = candidates.map((c) => c.medication_name).join(", ");
      return {
        status: "need_clarification" as const,
        reason: "multiple_medications",
        ask_message: `${input.time_slot}약이 여러 개 등록되어 있어요(${names}). 어떤 약인지 말씀해주시겠어요?`,
      };
    }
    medicationId = candidates[0].medication_id;
  }

  const medication = store.getMedicationById(medicationId);
  if (!medication) {
    return {
      status: "not_found" as const,
      ask_message: "그 약이 등록되어 있지 않아요. 약 이름을 다시 말씀해주실래요?",
    };
  }

  store.upsertMedicationLog({
    medication_id: medicationId,
    log_date: logDate,
    time_slot: input.time_slot,
    taken: input.taken,
  });

  return {
    status: "ok" as const,
    confirm_message: `${input.time_slot}약 ${label} 걸로 표시했어요.`,
  };
}
