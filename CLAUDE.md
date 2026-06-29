# 챙기미 작업 지침

이 프로젝트는 `dukpin` 레포와 완전히 분리된 별도 프로젝트입니다.
덕핀 운영지침(관리자/사용자 API 원칙, 인코딩 기준 등)은 이 프로젝트에 적용하지 않습니다.

> ⚠️ 2026-06-28 컨셉 전환: 이 프로젝트는 원래 "학교 안내문 → 준비물 체크리스트"
> (챙김비서) 컨셉이었으나, 사용자 승인에 따라 **"어르신 본인주도 병원예약/복약
> 리마인더"**(챙기미)로 전환되었다. 옛 컨셉 구현은 `legacy-kindergarten/`에
> 백업되어 있으며 더 이상 유지보수하지 않는다.

## 프로젝트 개요

- 이름: 챙기미
- 목적: Kakao AGENTIC PLAYER 10 예선 제출용 MCP 서버
- 핵심 흐름: 병원예약 등록 → 가족 공유(옵트인) → 약 등록 → 오늘 일정 조회 → 복약 완료 → 공유 해제
- 상세 기획/스펙: [docs/product-brief.md](docs/product-brief.md), [docs/mvp-scope.md](docs/mvp-scope.md), [docs/tool-spec.md](docs/tool-spec.md), [docs/demo-cases.md](docs/demo-cases.md), [docs/work-order-mvp.md](docs/work-order-mvp.md)

## MVP 범위 고정

포함 (MCP tool 6개):
- `add_hospital_appointment` — 병원 예약 등록 (음성/텍스트)
- `list_today_schedule` — 오늘 병원예약+복약 상태 조회
- `add_medication_text` — 약 등록 (텍스트, 시간대+식전후)
- `mark_medication_taken` — 복약 완료 처리
- `generate_share_summary` — 가족 전달용 공유문 생성 (직접 발송 아님)
- `update_share_scope` — 가족 공유 옵트인 on/off/범위변경

제외 (MVP 및 본선 확장 모두):
- 자체 스케줄러/cron, 능동 재확인 알림(30분 단위)
- 이미지 입력/OCR (약 등록은 텍스트만)
- 가족 직접 발송 (가족 OAuth 인증 미확정)
- 병원 예약 API/EMR 연동
- 금식·검사 전 안내 생성 (의료 판단 리스크)
- 미성년 자녀 관리 (권한모델이 반대됨, 별도 프로젝트 범위)
- 복약 주의사항 생성/설명 — 사용자가 준 원문 텍스트만 저장·노출

본선 확장 후보 (예선 자료에는 계획으로만 명시, 과대 약속 금지):
1. 자체 스케줄러 기반 능동 재확인 알림
2. 약봉투/처방전 사진 OCR 등록
3. 가족 OAuth 인증 플로우 + 직접 발송
4. 톡캘린더 연동

## 데모 안정성 원칙

- 능동 알림(30분 재확인)이 항상 된다고 전제하지 않는다 — 조회형(`list_today_schedule`)만으로도 핵심 가치가 보이게 설계한다.
- 가족 공유는 "직접 발송"이 아니라 "복사해서 전달할 문구 생성"으로 처리한다.
- 날짜 파싱이 모호하면 추정해서 등록하지 않고 반드시 재질문한다 (`need_clarification`).

## DB/영속성 기준

- 예선 MVP는 인메모리 store(`src/store.ts`) 기준으로 동작한다. 데이터는 프로세스 메모리에만 있다 — 3분 데모/예선 심사 범위에서는 허용 가능한 제한으로 본다.
- HTTP remote endpoint(`src/httpServer.ts`)는 **MCP 세션(Mcp-Session-Id) 단위로 store를 분리**한다. 서로 다른 세션(접속자)끼리는 데이터가 섞이지 않지만, 세션이 끝나면(DELETE 종료 또는 30분 유휴 초과) 그 store도 함께 사라진다 — 여전히 다중 사용자 영속 데이터에는 쓸 수 없는 데모 전용 구조다.
- 본선 진출 시 Supabase/Postgres 연결로 데이터 영속성을 확보한다 (`migrations/0001_chaeggimi_mvp.sql`).

## 작업 원칙

- 결정은 사용자가 한다. Claude는 의견·트레이드오프를 제시하되 결정을 대신하지 않는다.
- git 커밋은 사용자가 명시적으로 요청할 때만 한다.
- 범위를 벗어나는 기능 추가(스케줄러/OCR/가족 직접발송 등) 요청이 들어오면 먼저 트레이드오프를 보고하고 승인 후 진행한다.
- 작업지시서 작성은 GPT 담당, Claude는 승인된 작업지시서 기준으로만 구현한다.
