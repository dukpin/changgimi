# 챙기미 예선 MVP 구현 작업지시서

> 작성: GPT (기획/작업지시서 담당) · 정리: Claude (2026-06-28)
> 본 문서는 GPT가 작성한 작업지시서 원문을 그대로 옮긴 것이다. 승인 전까지
> Claude/Codex는 구현에 착수하지 않는다.

## 1. 작업 목표

카카오 PlayMCP "AGENTIC PLAYER 10" 예선 제출용 챙기미 MVP를 구현한다.
이번 목표는 완성형 서비스가 아니라 **2026-07-14 예선 제출용 3분 데모가 끊김 없이
동작하는 것**이다.

챙기미는 어르신 본인이 병원 예약과 복약 일정을 직접 등록·확인하고, 원할 때만
가족에게 공유문을 생성해 전달할 수 있도록 돕는 생활 리마인더 서비스다.

## 2. 구현 범위

### 2.1 MCP tool 6개

1. `add_hospital_appointment`
2. `list_today_schedule`
3. `add_medication_text`
4. `mark_medication_taken`
5. `generate_share_summary`
6. `update_share_scope`

### 2.2 DB 테이블 5개

1. `users`
2. `hospital_appointments`
3. `medications`
4. `medication_logs`
5. `share_scopes`

### 2.3 데모 플로우

```text
add_hospital_appointment
  → update_share_scope(enable) + generate_share_summary
    → add_medication_text
      → list_today_schedule
        → mark_medication_taken
          → update_share_scope(disable)
```

상세 입출력/검증 규칙은 [tool-spec.md](tool-spec.md), 데모 발화/기대값은
[demo-cases.md](demo-cases.md) 참조.

## 3. 제외 범위

| 제외 항목 | 사유 |
|---|---|
| 자체 스케줄러/cron, `reminder_jobs` | 예선 MVP 범위 초과 |
| 능동 재확인 알림/30분 반복 알림 | 자체 스케줄러 필요 |
| 이미지 입력/OCR, `add_medication_image`, `ocr_results` | Kakao Tools 이미지 입력 지원 미확인 |
| 가족 직접 발송, `send_family_notification`, `family_recipients` | 가족 OAuth 인증 플로우 미확정 |
| 병원 예약 API/EMR 연동 | 병원별 시스템 상이, 제휴 필요 |
| 금식·검사 전 안내 | 의료 판단 리스크 |
| 미성년 자녀 관리 | 권한 모델이 달라 별도 프로젝트 범위 |

## 4. DB 스키마 요구사항

상세 컬럼/타입/CHECK/UNIQUE는 [tool-spec.md](tool-spec.md) 하단 "DB 최소 스키마 요약" 및
아래를 따른다.

- `medications.time_slots`: CHECK `array_length>=1 AND time_slots <@ ARRAY['아침','점심','저녁']`
- `medications.timing`: CHECK `IN ('식전','식후')`
- `medication_logs.time_slot`: CHECK `IN ('아침','점심','저녁')`, UNIQUE `(medication_id, log_date, time_slot)`
- `share_scopes.scope`: CHECK `IN ('all','appointment_only','medication_only')`, UNIQUE `(user_id, recipient_label)`
- `medication_logs.updated_at`, `share_scopes.updated_at`: UPDATE 시 갱신 필요 — 트리거 또는
  애플리케이션 레이어 처리 중 하나를 선택하고, 선택 기준과 구현 위치를 완료 보고에 명시.

## 5. MCP tool 상세 요구사항

전체 입출력 스키마, 성공/실패 응답, 필드 규칙은 [tool-spec.md](tool-spec.md)를 단일 기준으로
한다 (중복 방지를 위해 본 작업지시서에는 요약만 둔다).

## 6. 데모 시나리오 요구사항

[demo-cases.md](demo-cases.md)의 성공 케이스 1개 + 분기 케이스 2개가 테스트 데이터 기준으로
1회씩 재현 가능해야 한다.

## 7. 금지사항

- 의료 판단 생성, 약 효능 설명 생성, 복용법 변경 제안, 금식/검사 전 안내 생성
- 진단명/검사결과 등 의료정보 필드 추가
- 가족 직접 발송 기능 선반영
- 자체 스케줄러/cron 선반영
- 이미지/OCR 기능 선반영
- 미성년 자녀 관리 기능 선반영
- 병원 API/EMR 연동 선반영
- 사용자가 승인하지 않은 추가 기능 구현

## 8. 완료 기준

완료 보고에 포함할 항목:

- 생성/수정한 파일 목록
- DB migration 내용
- MCP tool 6개 구현 여부
- 각 tool별 성공/실패 응답 테스트 결과
- 3분 데모 플로우 완주 여부
- CHECK/UNIQUE/FK/인덱스 적용 여부
- 보류 기능을 만들지 않았는지 확인
- 의료정보 필드를 만들지 않았는지 확인
- PlayMCP 등록/전체공개 준비 상태
- 남은 리스크

## 9. 승인 전 확인 필요 사항

- **구현 스택**: MCP 서버 언어/프레임워크, DB(Supabase vs 별도 Postgres) 확정 필요.
  기존 `package.json`은 `@modelcontextprotocol/sdk` + TypeScript + zod + vitest 기준으로
  세팅되어 있음(이전 "유치원 준비물" 컨셉 때 구성된 것 — 이번 컨셉에도 재사용 가능한지
  확인 필요).
- **기존 구현 처리**: 본 레포에 기존에 구현되어 있던 "유치원 준비물 체크리스트" 컨셉
  (tool 4종: `extract_notice_items`, `create_preparation_checklist`,
  `make_family_share_message`, `create_reminder_plan`, `src/*.ts`)은 2026-06-28
  사용자 승인으로 **폐기하고 본 작업지시서의 어르신 컨셉으로 새로 구축**하기로
  결정됨. 커밋 이력 없는 로컬 작업물이라 별도 아카이브 없이 교체 가능.

## 10. 승인 전 확인

Claude/Codex는 이 작업지시서 승인 전까지 구현에 착수하지 않는다. 승인 후에도 본 문서의
범위를 넘는 기능은 구현하지 않는다.
