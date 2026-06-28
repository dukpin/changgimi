# 챙기미 (changgim-assistant)

카카오톡 안에서 어르신이 병원 예약과 복약 일정을 직접 등록·확인하고, 원할 때만
가족에게 공유문을 전달할 수 있게 돕는 본인주도 생활 리마인더 에이전트입니다.

- 공모전: Kakao AGENTIC PLAYER 10 (예선 제출용 MCP MVP)
- 핵심 흐름: 병원예약 등록 → 가족 공유(옵트인) → 약 등록 → 오늘 일정 조회 → 복약 완료 → 공유 해제
- 상세 기획: [docs/product-brief.md](docs/product-brief.md)
- MVP 범위: [docs/mvp-scope.md](docs/mvp-scope.md)
- 데모 케이스: [docs/demo-cases.md](docs/demo-cases.md)
- Tool 스펙: [docs/tool-spec.md](docs/tool-spec.md)
- 구현 작업지시서: [docs/work-order-mvp.md](docs/work-order-mvp.md)
- DB migration: [migrations/0001_chaeggimi_mvp.sql](migrations/0001_chaeggimi_mvp.sql)

이 프로젝트는 `dukpin` 레포와 독립적인 별도 프로젝트입니다.

> 이전에 이 레포는 "학교 준비물 챙김" 컨셉(tool 4종)으로 구현되어 있었으나,
> 2026-06-28 사용자 승인으로 폐기되고 현재의 "어르신 본인주도 병원예약/복약"
> 컨셉으로 교체되었습니다. 옛 구현은 [legacy-kindergarten/](legacy-kindergarten/)에
> 백업되어 있습니다 (참고용, 더 이상 유지보수하지 않음).

## 실행

```bash
npm install
npm run build   # TypeScript -> dist/
npm start        # MCP stdio 서버 실행
npm test         # vitest
```

MCP Tool 6종(`add_hospital_appointment`, `list_today_schedule`, `add_medication_text`,
`mark_medication_taken`, `generate_share_summary`, `update_share_scope`)을 stdio로
제공합니다. 저장소는 예선 데모용 인메모리(`src/store.ts`)이며, 실제 배포 시
[migrations/0001_chaeggimi_mvp.sql](migrations/0001_chaeggimi_mvp.sql) 기준
Supabase/Postgres로 교체합니다.

## 검증

```bash
npm test                          # vitest 15개 (날짜 파싱 5 + 데모 플로우 10) — 15 passed
npx tsc --noEmit                  # 타입체크 — 에러 없음
npm run build
node scripts/verify-mcp-tools.mjs # 실제 MCP stdio 클라이언트로 6개 Tool 호출 검증
```

`scripts/verify-mcp-tools.mjs`는 `@modelcontextprotocol/sdk`의 `Client` +
`StdioClientTransport`로 `dist/index.js`를 실제 자식 프로세스로 띄워 데모 플로우
순서(예약 등록 → 가족 공유 켜기+공유문 생성 → 약 등록 → 오늘 일정 조회 → 복약
완료 → 공유 해제) 그대로 6개 Tool을 호출합니다.

### 데모 플로우 출력 예시

`add_hospital_appointment` (`"내일 오전 10시 분당서울대병원 예약 있어"` 의도):

```json
{
  "status": "ok",
  "appointment_id": "appt_1",
  "resolved_datetime": "2026-06-29T10:00:00+09:00",
  "confirm_message": "6월 29일(월) 오전 10시, 분당서울대병원 예약 등록했어요."
}
```

`update_share_scope(enable)` → `generate_share_summary` (`"딸한테도 알려줘"` 의도):

```json
{
  "status": "ok",
  "summary_text": "제가 6월 29일(월) 오전 10시 분당서울대병원 예약이 있어요.",
  "share_method": "copy_paste",
  "instruction": "이 문구를 복사해서 직접 전달하시면 돼요."
}
```

`mark_medication_taken` (`"아침약 먹었어"`, 이름 없이 발화 — 아침 슬롯 약이 1건이라 자동 매칭):

```json
{ "status": "ok", "confirm_message": "아침약 드신 걸로 표시했어요." }
```

전체 6단계 출력은 [docs/demo-cases.md](docs/demo-cases.md)의 기대값과 일치함을
`tests/tools.test.ts`와 `scripts/verify-mcp-tools.mjs`로 확인했습니다.
