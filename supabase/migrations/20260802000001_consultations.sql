-- 학부모 상담 신청·예약.
-- schedule_events(consultation 마커)를 확장하지 않는 이유: 그쪽은 "반 전체에 보이는
-- 읽기 전용 공지 마커"이고 여기는 "학생 1명에 귀속된 사적 요청 + 학부모 INSERT"다.
-- 가시성 규칙이 정반대라 한 테이블에 섞으면 기존 정책 전체가 보안 재검토 대상이 된다.
--
-- 상태 전이(requested→confirmed 등)는 이 파일에 없다. RLS는 "변경 전/후 행"만 볼 뿐
-- 전이 규칙을 표현하지 못하므로 UPDATE 정책을 아예 주지 않고 definer RPC로만 처리한다
-- (20260802000002_consultation_rpc.sql).

DO $$ BEGIN
    CREATE TYPE consultation_status AS ENUM ('requested','confirmed','rejected','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS consultations (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    academy_id     uuid NOT NULL REFERENCES academy(id)  ON DELETE CASCADE,
    student_id     uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    parent_id      uuid NOT NULL REFERENCES parents(id)  ON DELETE CASCADE,
    status         consultation_status NOT NULL DEFAULT 'requested',

    -- 신청 시 request_consultation RPC가 채운다. 정확한 시각이 아니라 오전/오후/저녁
    -- 3분할 — 학부모가 15:30을 찍게 하면 그 시간이 되는지 알 수 없어 반려율만 올라간다.
    preferred_date date NOT NULL,
    preferred_slot text NOT NULL,
    reason         text NOT NULL,

    -- 이름 스냅샷. 조인으로 대체할 수 없다: teacher는 parents를 읽는 정책이 아예 없고
    -- (parents_teacher_* 부재), students도 app_my_taught_student_ids() 범위로만 읽는다
    -- (20260531000001_rls_recursion_fix.sql:168). teacher가 학원 전체 상담을 보는 이상
    -- 조인 결과가 전부 비어버린다. RPC가 서버에서 조회해 채우므로 위조도 불가능하다.
    student_name   text NOT NULL,
    parent_name    text NOT NULL,

    -- 학원이 처리하며 채운다.
    scheduled_at   timestamptz NULL,
    handled_by     uuid NULL REFERENCES users(id) ON DELETE SET NULL,
    handler_name   text NULL,           -- 처리자 계정 삭제 후에도 이름을 남기는 스냅샷
    response_note  text NULL,
    responded_at   timestamptz NULL,

    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT consultations_confirmed_needs_time
        CHECK (status <> 'confirmed' OR scheduled_at IS NOT NULL),
    CONSTRAINT consultations_slot_valid
        CHECK (preferred_slot IN ('morning','afternoon','evening'))
);

CREATE INDEX IF NOT EXISTS idx_consultations_academy ON consultations(academy_id, status);
CREATE INDEX IF NOT EXISTS idx_consultations_student ON consultations(student_id);
CREATE INDEX IF NOT EXISTS idx_consultations_parent  ON consultations(parent_id);
CREATE INDEX IF NOT EXISTS idx_consultations_sched   ON consultations(scheduled_at)
    WHERE status = 'confirmed';

-- 학생당 대기 중 요청은 1건만. UI도 막지만 진짜 방어선은 여기다.
CREATE UNIQUE INDEX IF NOT EXISTS uq_consultation_pending
    ON consultations(student_id) WHERE status = 'requested';

ALTER TABLE consultations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS consultations_admin_all ON consultations;
CREATE POLICY consultations_admin_all ON consultations FOR ALL TO authenticated
    USING (is_admin()) WITH CHECK (is_admin());

-- parent: 본인이 신청한 건만 열람
DROP POLICY IF EXISTS consultations_parent_select ON consultations;
CREATE POLICY consultations_parent_select ON consultations FOR SELECT TO authenticated
    USING (
        current_user_role() = 'parent'
        AND parent_id IN (SELECT app_my_parent_ids())
    );

-- owner/teacher: 학원 전체 열람. teacher를 담당 반으로 좁히지 않는 이유는
-- 담임이 자리를 비웠을 때 다른 선생님이 받을 수 있어야 하는 운영 요구다.
DROP POLICY IF EXISTS consultations_staff_select ON consultations;
CREATE POLICY consultations_staff_select ON consultations FOR SELECT TO authenticated
    USING (
        current_user_role() IN ('owner','teacher')
        AND academy_id = current_user_academy()
    );

-- INSERT/UPDATE/DELETE 정책 없음(admin 제외) → 신청을 포함한 모든 쓰기가 RPC 경유다.
-- notifications와 같은 구조. 학부모 INSERT 정책을 두지 않는 이유:
--   1) student_name/parent_name 스냅샷을 클라가 보내면 위조 가능
--   2) 신청 INSERT와 스태프 알림이 한 트랜잭션이어야 알림 유실이 없다
--   3) confirm/reject/cancel이 이미 전부 RPC — 신청만 직접 INSERT면 비일관적
