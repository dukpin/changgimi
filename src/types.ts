export type TimeSlot = "아침" | "점심" | "저녁";
export type Timing = "식전" | "식후";
export type ShareScopeValue = "all" | "appointment_only" | "medication_only";

export interface HospitalAppointment {
  appointment_id: string;
  user_id: string;
  hospital_name: string;
  department: string | null;
  appointment_at: string; // ISO datetime, KST offset
  memo: string | null;
  created_at: string;
}

export interface Medication {
  medication_id: string;
  user_id: string;
  medication_name: string;
  time_slots: TimeSlot[];
  timing: Timing;
  raw_caution_text: string | null;
  created_at: string;
}

export interface MedicationLog {
  medication_id: string;
  log_date: string; // YYYY-MM-DD
  time_slot: TimeSlot;
  taken: boolean;
  updated_at: string;
}

export interface ShareScope {
  user_id: string;
  recipient_label: string;
  scope: ShareScopeValue;
  enabled: boolean;
  updated_at: string;
}
