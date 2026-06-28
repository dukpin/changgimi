-- 챙기미 예선 MVP 최소 스키마 (Supabase/Postgres 기준)
-- 범위: users, hospital_appointments, medications, medication_logs, share_scopes
-- 보류(미생성): reminder_jobs, family_recipients, ocr_results
-- 진단명/검사결과 등 의료정보 필드는 어디에도 포함하지 않는다.

create extension if not exists "pgcrypto";

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  kakao_user_key text not null unique,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists hospital_appointments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id),
  hospital_name text not null,
  department text,
  appointment_at timestamptz not null,
  memo text,
  created_at timestamptz not null default now()
);

create index if not exists idx_hospital_appointments_user_time
  on hospital_appointments (user_id, appointment_at);

create table if not exists medications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id),
  medication_name text not null,
  time_slots text[] not null,
  timing text not null,
  raw_caution_text text,
  created_at timestamptz not null default now(),
  constraint medications_time_slots_check check (
    array_length(time_slots, 1) >= 1
    and time_slots <@ array['아침', '점심', '저녁']
  ),
  constraint medications_timing_check check (timing in ('식전', '식후'))
);

create table if not exists medication_logs (
  id uuid primary key default gen_random_uuid(),
  medication_id uuid not null references medications (id),
  log_date date not null,
  time_slot text not null,
  taken boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint medication_logs_time_slot_check check (time_slot in ('아침', '점심', '저녁')),
  constraint medication_logs_unique unique (medication_id, log_date, time_slot)
);

create table if not exists share_scopes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id),
  recipient_label text not null,
  scope text not null,
  enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint share_scopes_scope_check check (scope in ('all', 'appointment_only', 'medication_only')),
  constraint share_scopes_unique unique (user_id, recipient_label)
);

-- updated_at 자동 갱신: 애플리케이션 레이어 처리 대신 트리거로 통일한다.
-- (이유: MVP 코드에서 UPDATE 경로가 여러 tool에 흩어져 있어, DB 트리거로
--  일관되게 보장하는 쪽이 누락 위험이 적다.)
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_medication_logs_updated_at on medication_logs;
create trigger trg_medication_logs_updated_at
  before update on medication_logs
  for each row execute function set_updated_at();

drop trigger if exists trg_share_scopes_updated_at on share_scopes;
create trigger trg_share_scopes_updated_at
  before update on share_scopes
  for each row execute function set_updated_at();
