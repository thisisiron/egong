-- 일정 관리: 세션 타입(정규/보강/특강) + 휴강 + 이벤트 마커(시험/상담)
-- enum은 향후 확장(방학/공휴일 등) 대비 값만 추가 가능하게 설계.

-- ===== ENUMS =====
DO $$ BEGIN
    CREATE TYPE session_type AS ENUM ('regular', 'makeup', 'special');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE event_type AS ENUM ('exam', 'consultation');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ===== SESSIONS 컬럼 추가 =====
ALTER TABLE sessions
    ADD COLUMN IF NOT EXISTS type session_type NOT NULL DEFAULT 'regular',
    ADD COLUMN IF NOT EXISTS cancelled boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS cancel_reason text NULL;

-- ===== SCHEDULE_EVENTS 테이블 =====
CREATE TABLE IF NOT EXISTS schedule_events (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    academy_id  uuid NOT NULL REFERENCES academy(id) ON DELETE CASCADE,
    class_id    uuid NULL REFERENCES classes(id) ON DELETE CASCADE,  -- NULL = 학원 전체
    type        event_type NOT NULL,
    title       text NOT NULL,
    event_date  date NOT NULL,
    memo        text NULL,
    created_by  uuid REFERENCES users(id) ON DELETE SET NULL,
    author_name text NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_schedule_events_academy ON schedule_events(academy_id);
CREATE INDEX IF NOT EXISTS idx_schedule_events_class ON schedule_events(class_id);
CREATE INDEX IF NOT EXISTS idx_schedule_events_date ON schedule_events(event_date);

ALTER TABLE schedule_events ENABLE ROW LEVEL SECURITY;

-- ===== SCHEDULE_EVENTS RLS (announcements 패턴 복제) =====
CREATE POLICY schedule_events_admin_all ON schedule_events FOR ALL TO authenticated
    USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY schedule_events_owner_all ON schedule_events FOR ALL TO authenticated
    USING (current_user_role() = 'owner' AND academy_id = current_user_academy())
    WITH CHECK (current_user_role() = 'owner' AND academy_id = current_user_academy());

-- teacher: 자기 학원 이벤트 전체 열람
CREATE POLICY schedule_events_teacher_read ON schedule_events FOR SELECT TO authenticated
    USING (current_user_role() = 'teacher' AND academy_id = current_user_academy());

-- teacher: 담당 반 이벤트만 작성 (class_id NULL=전체는 작성 불가, owner만)
CREATE POLICY schedule_events_teacher_insert ON schedule_events FOR INSERT TO authenticated
    WITH CHECK (
        current_user_role() = 'teacher'
        AND academy_id = current_user_academy()
        AND created_by = auth.uid()
        AND class_id IN (SELECT app_my_taught_class_ids())
    );

CREATE POLICY schedule_events_teacher_update ON schedule_events FOR UPDATE TO authenticated
    USING (
        current_user_role() = 'teacher'
        AND created_by = auth.uid()
        AND academy_id = current_user_academy()
    )
    WITH CHECK (created_by = auth.uid() AND class_id IN (SELECT app_my_taught_class_ids()));

CREATE POLICY schedule_events_teacher_delete ON schedule_events FOR DELETE TO authenticated
    USING (
        current_user_role() = 'teacher'
        AND created_by = auth.uid()
        AND academy_id = current_user_academy()
    );

-- student: 학원 전체 이벤트(class_id NULL) + 자기 반 이벤트 읽기
CREATE POLICY schedule_events_student_read ON schedule_events FOR SELECT TO authenticated
    USING (
        current_user_role() = 'student'
        AND (
            (class_id IS NULL AND academy_id = current_user_academy())
            OR class_id IN (SELECT app_my_enrolled_class_ids())
        )
    );

-- parent: 학원 전체 이벤트 + 자녀 반 이벤트 읽기
CREATE POLICY schedule_events_parent_read ON schedule_events FOR SELECT TO authenticated
    USING (
        current_user_role() = 'parent'
        AND (
            (class_id IS NULL AND academy_id = current_user_academy())
            OR class_id IN (SELECT app_my_child_class_ids())
        )
    );
