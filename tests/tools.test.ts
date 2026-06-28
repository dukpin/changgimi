import { beforeEach, describe, expect, it } from "vitest";
import { ChaeggimiStore } from "../src/store.js";
import { addHospitalAppointment } from "../src/tools/addHospitalAppointment.js";
import { listTodaySchedule } from "../src/tools/listTodaySchedule.js";
import { addMedicationText } from "../src/tools/addMedicationText.js";
import { markMedicationTaken } from "../src/tools/markMedicationTaken.js";
import { generateShareSummary } from "../src/tools/generateShareSummary.js";
import { updateShareScope } from "../src/tools/updateShareScope.js";

const USER = "demo-user";

describe("챙기미 MVP 데모 플로우", () => {
  let store: ChaeggimiStore;

  beforeEach(() => {
    store = new ChaeggimiStore();
  });

  it("1. 병원 예약 등록", () => {
    const result = addHospitalAppointment(store, {
      user_id: USER,
      hospital_name: "분당서울대병원",
      datetime_text: "내일 오전 10시",
    });
    expect(result.status).toBe("ok");
  });

  it("날짜가 모호하면 추정하지 않고 재질문한다", () => {
    const result = addHospitalAppointment(store, {
      user_id: USER,
      hospital_name: "분당서울대병원",
      datetime_text: "언젠가",
    });
    expect(result.status).toBe("need_clarification");
  });

  it("2. 가족 공유 켜기 + 공유문 생성", () => {
    addHospitalAppointment(store, {
      user_id: USER,
      hospital_name: "분당서울대병원",
      datetime_text: "내일 오전 10시",
    });
    const scopeResult = updateShareScope(store, {
      user_id: USER,
      recipient_label: "딸",
      action: "enable",
    });
    expect(scopeResult).toMatchObject({ status: "ok", delivery_method: "summary_only" });

    const summary = generateShareSummary(store, {
      user_id: USER,
      scope: "upcoming_appointment",
      owner_label: "저",
    });
    expect(summary.status).toBe("ok");
    if (summary.status === "ok") {
      expect(summary.summary_text).toContain("분당서울대병원");
      expect(summary.share_method).toBe("copy_paste");
    }
  });

  it("3. 약 등록", () => {
    const result = addMedicationText(store, {
      user_id: USER,
      medication_name: "혈압약",
      time_slots: ["아침", "저녁"],
      timing: "식후",
    });
    expect(result.status).toBe("ok");
  });

  it("4. 오늘 일정 조회 — 등록된 예약/약을 함께 보여준다", () => {
    addHospitalAppointment(store, {
      user_id: USER,
      hospital_name: "분당서울대병원",
      datetime_text: "오늘 오전 10시",
    });
    addMedicationText(store, {
      user_id: USER,
      medication_name: "혈압약",
      time_slots: ["아침"],
      timing: "식후",
    });
    const schedule = listTodaySchedule(store, { user_id: USER });
    expect(schedule.status).toBe("ok");
    expect(schedule.appointments).toHaveLength(1);
    expect(schedule.medications).toHaveLength(1);
  });

  it("일정이 없으면 empty 상태를 반환한다", () => {
    const schedule = listTodaySchedule(store, { user_id: USER });
    expect(schedule.status).toBe("empty");
  });

  it("5. 복약 완료 처리 — 약 이름 없이도 1건이면 자동 매칭", () => {
    addMedicationText(store, {
      user_id: USER,
      medication_name: "혈압약",
      time_slots: ["아침"],
      timing: "식후",
    });
    const result = markMedicationTaken(store, {
      user_id: USER,
      time_slot: "아침",
      taken: true,
    });
    expect(result.status).toBe("ok");
  });

  it("같은 시간대 약이 2건이면 재질문한다", () => {
    addMedicationText(store, {
      user_id: USER,
      medication_name: "혈압약",
      time_slots: ["아침"],
      timing: "식후",
    });
    addMedicationText(store, {
      user_id: USER,
      medication_name: "당뇨약",
      time_slots: ["아침"],
      timing: "식전",
    });
    const result = markMedicationTaken(store, {
      user_id: USER,
      time_slot: "아침",
      taken: true,
    });
    expect(result.status).toBe("need_clarification");
  });

  it("6. 가족 공유 해제", () => {
    updateShareScope(store, { user_id: USER, recipient_label: "딸", action: "enable" });
    const result = updateShareScope(store, { user_id: USER, recipient_label: "딸", action: "disable" });
    expect(result).toMatchObject({ status: "ok", confirm_message: "딸한테 공유, 꺼놨어요." });
  });

  it("전체 데모 플로우가 끊김 없이 1회 완주된다", () => {
    const appt = addHospitalAppointment(store, {
      user_id: USER,
      hospital_name: "분당서울대병원",
      datetime_text: "내일 오전 10시",
    });
    expect(appt.status).toBe("ok");

    const enable = updateShareScope(store, { user_id: USER, recipient_label: "딸", action: "enable" });
    expect(enable.status).toBe("ok");

    const summary = generateShareSummary(store, { user_id: USER, scope: "upcoming_appointment" });
    expect(summary.status).toBe("ok");

    const med = addMedicationText(store, {
      user_id: USER,
      medication_name: "혈압약",
      time_slots: ["아침", "저녁"],
      timing: "식후",
    });
    expect(med.status).toBe("ok");

    const schedule = listTodaySchedule(store, { user_id: USER });
    expect(schedule.status).toBe("ok");

    const taken = markMedicationTaken(store, { user_id: USER, time_slot: "아침", taken: true });
    expect(taken.status).toBe("ok");

    const disable = updateShareScope(store, { user_id: USER, recipient_label: "딸", action: "disable" });
    expect(disable.status).toBe("ok");
  });
});
