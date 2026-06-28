import type { ChaeggimiStore } from "../store.js";
import type { TimeSlot, Timing } from "../types.js";

export interface AddMedicationTextInput {
  user_id: string;
  medication_name: string;
  time_slots: TimeSlot[];
  timing: Timing;
  raw_caution_text?: string;
}

export function addMedicationText(store: ChaeggimiStore, input: AddMedicationTextInput) {
  if (!input.medication_name.trim()) {
    return {
      status: "need_clarification" as const,
      reason: "missing_medication_name",
      ask_message: "약 이름을 말씀해주시겠어요?",
    };
  }
  if (!input.time_slots || input.time_slots.length === 0) {
    return {
      status: "need_clarification" as const,
      reason: "missing_time_slots",
      ask_message: "아침, 점심, 저녁 중 언제 드시는 약인가요?",
    };
  }

  const record = store.addMedication({
    user_id: input.user_id,
    medication_name: input.medication_name,
    time_slots: input.time_slots,
    timing: input.timing,
    raw_caution_text: input.raw_caution_text ?? null,
  });

  const slotLabel = input.time_slots.join("");
  return {
    status: "ok" as const,
    medication_id: record.medication_id,
    confirm_message: `${input.medication_name}, ${slotLabel} ${input.timing}로 등록했어요.`,
  };
}
