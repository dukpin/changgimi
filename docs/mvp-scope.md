# MVP 범위

## 핵심 흐름 (예선 생존 MVP, 고정)

```
add_hospital_appointment
  → update_share_scope(enable) + generate_share_summary
    → add_medication_text
      → list_today_schedule
        → mark_medication_taken
          → update_share_scope(disable)
```

## 포함 (MCP tool 6개)

1. `add_hospital_appointment` — 병원 예약 등록 (음성/텍스트)
2. `list_today_schedule` — 오늘 병원예약+복약 상태 한눈에 조회
3. `add_medication_text` — 약 등록 (텍스트, 아침/점심/저녁 + 식전/식후)
4. `mark_medication_taken` — 복약 완료 처리 (이름 없는 발화도 자동매칭/재질문)
5. `generate_share_summary` — 가족 전달용 공유문 생성 (복사 전달 방식)
6. `update_share_scope` — 가족 공유 켜기/범위 변경/끄기 (옵트인)

## 포함 (DB 테이블 5개)

`users`, `hospital_appointments`, `medications`, `medication_logs`, `share_scopes`

## 제외 (MVP + 본선 확장 모두 보류)

| 제외 항목 | 사유 |
|---|---|
| 자체 스케줄러/cron, `reminder_jobs` | 예선 MVP 범위 초과 — 능동 재확인(30분 단위)에 필요하나 인프라 구축 부담 큼 |
| 이미지 입력/OCR, `add_medication_image`, `ocr_results` | Kakao Tools 이미지 입력 widget 스펙 지원 여부 [미확인] |
| 가족 직접 발송, `send_family_notification`, `family_recipients` | 수신 가족도 카카오 OAuth 인증이 필요하다는 제약 확인됨, 인증 플로우 미확정 |
| 병원 예약 API/EMR 연동 | 병원별 시스템 상이, 제휴 필요 |
| 금식·검사 전 안내 생성 | 의료 판단 리스크 |
| 미성년 자녀 관리 | 권한모델이 보호자주도로 반대됨 — 별도 제품 영역 |
| 복약 주의사항 생성/설명 | 의료법 리스크. 사용자가 준 원문 텍스트만 저장·노출 |

## 본선 확장 후보 (구현 약속 아님, 계획만)

1. 자체 스케줄러 기반 능동 재확인 알림 (30분 단위)
2. 약봉투/처방전 사진 OCR 등록
3. 가족 OAuth 인증 플로우 + 직접 발송
4. 톡캘린더 연동

## 데모 안정성 원칙

- "능동 알림이 항상 된다"고 전제하지 않는다 — 조회형(오늘 일정 보기)만으로도 핵심 가치가 보이게 설계.
- 가족 공유는 "직접 발송"이 아니라 "복사해서 전달할 문구 생성"으로 안전하게 처리한다.
- 날짜 파싱이 모호하면 추정해서 등록하지 않고 반드시 재질문한다.

## 레포 분리 사유

dukpin(K-POP 큐레이션)과 챙기미(어르신 생활 리마인더)는 타깃·데이터 모델·공모전 메시지가
전혀 다르므로 별도 레포로 분리한다. 코드/지침 공유 없음.
