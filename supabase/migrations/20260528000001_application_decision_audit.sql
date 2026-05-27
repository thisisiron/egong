-- Decision audit columns for approval flow.
-- When admin approves an application, all 4 are populated atomically.
-- The CHECK enforces both-or-nothing (matches our service-layer transaction).
-- IF NOT EXISTS guards make this safe to re-run after a partial prior apply.

alter table public.academy_applications
  add column if not exists approved_at timestamptz null,
  add column if not exists decided_by uuid null references public.users(id),
  add column if not exists created_academy_id uuid null references public.academies(id),
  add column if not exists created_owner_user_id uuid null references public.users(id);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.academy_applications'::regclass
      and conname = 'academy_applications_approved_quad_chk'
  ) then
    alter table public.academy_applications
      add constraint academy_applications_approved_quad_chk
      check (
        (status != 'approved' and approved_at is null
           and decided_by is null and created_academy_id is null
           and created_owner_user_id is null)
        or (status = 'approved' and approved_at is not null
           and decided_by is not null and created_academy_id is not null
           and created_owner_user_id is not null)
      );
  end if;
end$$;

comment on column public.academy_applications.approved_at is
  '승인된 시각 (status=approved일 때 채워짐).';
comment on column public.academy_applications.decided_by is
  '승인 누른 admin의 user_id.';
comment on column public.academy_applications.created_academy_id is
  '승인 시 생성된 학원 ID.';
comment on column public.academy_applications.created_owner_user_id is
  '승인 시 생성된 원장 user ID.';
