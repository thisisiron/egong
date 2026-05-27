-- Audit trail for NTS business verification at the time of submission.
-- Both columns NULL until /apply form starts collecting them; backfill not needed.

alter table public.academy_applications
  add column verified_at timestamptz null,
  add column verified_b_stt_cd text null;

-- Sanity: when verified_at is set, the status code must also be set (and vice versa).
-- A neutral CHECK so future writers can't store half-info.
alter table public.academy_applications
  add constraint academy_applications_verified_pair_chk
  check (
    (verified_at is null and verified_b_stt_cd is null)
    or (verified_at is not null and verified_b_stt_cd is not null)
  );

-- Document
comment on column public.academy_applications.verified_at is
  '진위확인 통과 후 제출된 시각. NULL이면 진위확인 거치지 않음(개원예정) 또는 구 신청.';
comment on column public.academy_applications.verified_b_stt_cd is
  '진위확인 통과 당시의 NTS 사업자 상태 코드: 01=계속, 02=휴업. NULL이면 verified_at도 NULL.';
