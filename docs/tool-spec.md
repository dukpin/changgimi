# MCP Tool 스펙

## MVP 포함 Tool

| Tool | 역할 | MVP 여부 |
|---|---|---|
| `add_hospital_appointment` | 병원 예약 등록 (음성/텍스트 자연어 파싱) | 필수 |
| `list_today_schedule` | 오늘 병원예약+복약 상태 조회 | 필수 |
| `add_medication_text` | 약 등록 (텍스트, 시간대+식전후) | 필수 |
| `mark_medication_taken` | 복약 완료 처리 | 필수 |
| `generate_share_summary` | 가족 전달용 공유문 생성 | 필수 |
| `update_share_scope` | 가족 공유 옵트인 on/off/범위변경 | 필수 |

후순위(이번 MVP 범위 밖, 조건부 향후 추가): `add_medication_image`, `schedule_reminder_job`,
`send_family_notification`.

## 공통 원칙

- 의료 판단(효능/용법변경/금식안내 생성) 금지.
- 진단명/검사결과 등 의료정보 필드 없음.
- 날짜/시간 파싱 모호 시 추정 등록하지 않고 `need_clarification` 반환.
- 모든 시각은 KST(Asia/Seoul) 기준.

## 1. `add_hospital_appointment`

### Input

```json
{
  "hospital_name": "string required",
  "datetime_text": "string required",
  "department": "string optional",
  "memo": "string optional, max 50"
}
```

### Output (성공)

```json
{
  "status": "ok",
  "appointment_id": "string",
  "resolved_datetime": "2026-06-29T10:00:00+09:00",
  "confirm_message": "6월 29일(월) 오전 10시, 분당서울대병원 예약 등록했어요."
}
```

### Output (실패 — 날짜 모호)

```json
{
  "status": "need_clarification",
  "reason": "ambiguous_date",
  "ask_message": "날짜를 정확히 확인해주시겠어요?"
}
```

### 규칙

- `hospital_name` 공백 불가.
- `datetime_text`는 KST 기준으로 파싱.
- 파싱 실패/모호하면 임의 등록하지 않고 `need_clarification` 반환.
- 과거 날짜로 파싱되면 재확인 요청.

## 2. `list_today_schedule`

### Input

```json
{ "date": "string optional, YYYY-MM-DD" }
```

### Output

```json
{
  "status": "ok",
  "date": "2026-06-29",
  "appointments": [
    { "appointment_id": "string", "hospital_name": "string", "time": "10:00", "department": "string" }
  ],
  "medications": [
    { "medication_id": "string", "name": "string", "time_slot": "아침|점심|저녁", "taken": true }
  ],
  "summary_message": "오늘 오전 10시 안과 예약 있고, 아침약은 드셨어요. 점심약은 아직이에요."
}
```

### 규칙

- `date` 미입력 시 KST 기준 오늘.
- 복약 로그가 없으면 해당 슬롯은 `taken:false`로 간주.
- 내부 오류가 있어도 안정적인 실패 메시지를 반환 (깨진 응답 금지).

## 3. `add_medication_text`

### Input

```json
{
  "medication_name": "string required",
  "time_slots": ["아침", "저녁"],
  "timing": "식후",
  "raw_caution_text": "string optional"
}
```

### Output

```json
{
  "status": "ok",
  "medication_id": "string",
  "confirm_message": "혈압약, 아침저녁 식후로 등록했어요."
}
```

### 규칙

- `medication_name` 공백 불가.
- `time_slots`는 아침/점심/저녁 중 1개 이상.
- `timing`은 식전/식후만 허용.
- `raw_caution_text`는 사용자가 직접 준 텍스트만 저장 — LLM이 보완/생성하지 않음.

## 4. `mark_medication_taken`

### Input

```json
{
  "medication_id": "string optional",
  "medication_name": "string optional",
  "time_slot": "아침|점심|저녁 required",
  "taken": true,
  "date": "string optional, YYYY-MM-DD"
}
```

### Output (성공)

```json
{ "status": "ok", "confirm_message": "아침약 드신 걸로 표시했어요." }
```

### Output (다건 재질문)

```json
{
  "status": "need_clarification",
  "reason": "multiple_medications",
  "ask_message": "아침약이 두 개 등록되어 있어요. 어떤 약인지 말씀해주시겠어요?"
}
```

### 규칙

- `medication_id` 있으면 우선 매칭.
- 없고 `medication_name`도 없으면 해당 시간대 약이 1건일 때만 자동 매칭, 2건 이상이면 재질문.
- 로그는 `(medication_id, log_date, time_slot)` 기준 upsert/update. 중복 입력은 마지막 입력으로 덮어씀.

## 5. `generate_share_summary`

### Input

```json
{
  "scope": "today|upcoming_appointment|specific_appointment",
  "appointment_id": "string optional",
  "owner_label": "저"
}
```

### Output

```json
{
  "status": "ok",
  "summary_text": "제가 6월 29일(월) 오전 10시 분당서울대병원 예약이 있어요.",
  "share_method": "copy_paste",
  "instruction": "이 문구를 복사해서 직접 전달하시면 돼요."
}
```

### 규칙

- 복사 전달용 텍스트만 생성 — 가족에게 직접 발송하지 않음.
- 공유문에는 병원명/예약일시/복약여부만 포함. 진단명·검사결과·의료적 해석 금지.
- `owner_label`은 화자 1인칭("저")으로 고정.

## 6. `update_share_scope`

### Input

```json
{
  "recipient_label": "딸",
  "action": "enable|disable",
  "scope": "all|appointment_only|medication_only"
}
```

### Output

```json
{
  "status": "ok",
  "delivery_method": "summary_only",
  "confirm_message": "딸한테 공유, 켜놨어요."
}
```

### 규칙

- `recipient_label`은 공유받는 사람 기준.
- `scope` 미입력 시 `all`.
- 가족 OAuth 직접 발송은 구현하지 않음 — `delivery_method`는 이번 MVP에서 항상 `summary_only`.
- enable/disable은 `share_scopes`에 upsert/update.

## DB 최소 스키마 요약

| 테이블 | 핵심 제약 |
|---|---|
| `users` | `kakao_user_key` UNIQUE |
| `hospital_appointments` | 인덱스 `(user_id, appointment_at)` |
| `medications` | CHECK `time_slots ⊆ {아침,점심,저녁}`, CHECK `timing IN (식전,식후)` |
| `medication_logs` | CHECK `time_slot`, UNIQUE `(medication_id, log_date, time_slot)` |
| `share_scopes` | CHECK `scope`, UNIQUE `(user_id, recipient_label)` |

진단명/검사결과 필드는 어디에도 없음. `updated_at` 갱신 방식(트리거 vs 애플리케이션 처리)은
구현 단계에서 택1 후 완료 보고에 명시.
