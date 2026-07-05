import type { HospitalAppointment, Medication, MedicationLog, ShareScope } from "./types.js";

/**
 * 예선 데모용 인메모리 저장소. 실제 배포 시에는 migrations/0001_chaeggimi_mvp.sql
 * 기준 Supabase/Postgres로 교체한다. 이 파일은 DB 접근을 한 곳에 모아두는
 * repository 경계 역할을 하므로, 교체 시 이 모듈만 바꾸면 된다.
 */
export class ChaeggimiStore {
  private appointments: HospitalAppointment[] = [];
  private medications: Medication[] = [];
  private medicationLogs: MedicationLog[] = [];
  private shareScopes: ShareScope[] = [];
  private seq = 0;

  private nextId(prefix: string): string {
    this.seq += 1;
    return `${prefix}_${this.seq}`;
  }

  addAppointment(input: Omit<HospitalAppointment, "appointment_id" | "created_at">): HospitalAppointment {
    const record: HospitalAppointment = {
      ...input,
      appointment_id: this.nextId("appt"),
      created_at: new Date().toISOString(),
    };
    this.appointments.push(record);
    return record;
  }

  listAppointmentsByDate(userId: string, isoDate: string): HospitalAppointment[] {
    return this.appointments.filter(
      (a) => a.user_id === userId && a.appointment_at.startsWith(isoDate),
    );
  }

  getUpcomingAppointment(userId: string, now: Date = new Date()): HospitalAppointment | null {
    const nowMs = now.getTime();
    const list = this.appointments
      .filter((a) => a.user_id === userId && new Date(a.appointment_at).getTime() >= nowMs)
      .sort((a, b) => a.appointment_at.localeCompare(b.appointment_at));
    return list[0] ?? null;
  }

  getAppointmentById(id: string): HospitalAppointment | null {
    return this.appointments.find((a) => a.appointment_id === id) ?? null;
  }

  addMedication(input: Omit<Medication, "medication_id" | "created_at">): Medication {
    const record: Medication = {
      ...input,
      medication_id: this.nextId("med"),
      created_at: new Date().toISOString(),
    };
    this.medications.push(record);
    return record;
  }

  listMedications(userId: string): Medication[] {
    return this.medications.filter((m) => m.user_id === userId);
  }

  listMedicationsByTimeSlot(userId: string, timeSlot: string): Medication[] {
    return this.medications.filter(
      (m) => m.user_id === userId && m.time_slots.includes(timeSlot as Medication["time_slots"][number]),
    );
  }

  getMedicationById(id: string): Medication | null {
    return this.medications.find((m) => m.medication_id === id) ?? null;
  }

  findMedicationByName(userId: string, name: string): Medication | null {
    return (
      this.medications.find((m) => m.user_id === userId && m.medication_name === name) ?? null
    );
  }

  upsertMedicationLog(input: Omit<MedicationLog, "updated_at">): MedicationLog {
    const existing = this.medicationLogs.find(
      (l) =>
        l.medication_id === input.medication_id &&
        l.log_date === input.log_date &&
        l.time_slot === input.time_slot,
    );
    const updated_at = new Date().toISOString();
    if (existing) {
      existing.taken = input.taken;
      existing.updated_at = updated_at;
      return existing;
    }
    const record: MedicationLog = { ...input, updated_at };
    this.medicationLogs.push(record);
    return record;
  }

  getMedicationLog(medicationId: string, logDate: string, timeSlot: string): MedicationLog | null {
    return (
      this.medicationLogs.find(
        (l) => l.medication_id === medicationId && l.log_date === logDate && l.time_slot === timeSlot,
      ) ?? null
    );
  }

  upsertShareScope(input: Omit<ShareScope, "updated_at">): ShareScope {
    const existing = this.shareScopes.find(
      (s) => s.user_id === input.user_id && s.recipient_label === input.recipient_label,
    );
    const updated_at = new Date().toISOString();
    if (existing) {
      existing.scope = input.scope;
      existing.enabled = input.enabled;
      existing.updated_at = updated_at;
      return existing;
    }
    const record: ShareScope = { ...input, updated_at };
    this.shareScopes.push(record);
    return record;
  }
}
