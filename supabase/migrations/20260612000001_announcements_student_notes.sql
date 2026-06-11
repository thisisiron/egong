-- 공지사항(announcements) + 상담 메모(student_notes)
--
-- 공지: owner/teacher 작성. class_id NULL = 학원 전체, 값 있으면 반별.
--       teacher는 담당 반 공지만 작성 가능(전체 공지 불가), 본인 작성분만 수정/삭제.
--       학부모/학생은 전체 공지 + 자기(자녀) 반 공지 열람.
-- 메모: 내부 운영 기록 — student/parent 정책 자체가 없음 = 접근 불가.
--
-- author_name: 작성 시점 display_name 스냅샷. users RLS상 teacher/parent가
-- 타인의 users row를 못 읽어 조인 표시가 불가능하므로 저장 방식 채택.
-- created_by는 권한 판정(본인 작성분 수정/삭제)용.
--
-- 멤버십 판정은 app_* SECURITY DEFINER 헬퍼(20260531000001) 사용 — RLS 재귀 방지.

CREATE TABLE announcements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    academy_id uuid NOT NULL REFERENCES academy(id) ON DELETE CASCADE,
    class_id uuid REFERENCES classes(id) ON DELETE CASCADE,  -- NULL = 학원 전체
    title text NOT NULL,
    body text NOT NULL,
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    author_name text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_announcements_academy ON announcements(academy_id);
CREATE INDEX idx_announcements_class ON announcements(class_id);

CREATE TABLE student_notes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    body text NOT NULL,
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    author_name text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_student_notes_student ON student_notes(student_id);

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_notes ENABLE ROW LEVEL SECURITY;

-- ===== ANNOUNCEMENTS =====
CREATE POLICY announcements_admin_all ON announcements FOR ALL TO authenticated
    USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY announcements_owner_all ON announcements FOR ALL TO authenticated
    USING (current_user_role() = 'owner' AND academy_id = current_user_academy())
    WITH CHECK (current_user_role() = 'owner' AND academy_id = current_user_academy());

-- teacher: 자기 학원 공지 전체 열람
CREATE POLICY announcements_teacher_read ON announcements FOR SELECT TO authenticated
    USING (current_user_role() = 'teacher' AND academy_id = current_user_academy());

-- teacher: 담당 반 공지만 작성 (class_id NULL이면 IN 검사 실패 → 전체 공지 불가)
CREATE POLICY announcements_teacher_insert ON announcements FOR INSERT TO authenticated
    WITH CHECK (
        current_user_role() = 'teacher'
        AND academy_id = current_user_academy()
        AND created_by = auth.uid()
        AND class_id IN (SELECT app_my_taught_class_ids())
    );

-- teacher: 본인 작성분만 수정/삭제
CREATE POLICY announcements_teacher_update ON announcements FOR UPDATE TO authenticated
    USING (current_user_role() = 'teacher' AND created_by = auth.uid())
    WITH CHECK (created_by = auth.uid() AND class_id IN (SELECT app_my_taught_class_ids()));

CREATE POLICY announcements_teacher_delete ON announcements FOR DELETE TO authenticated
    USING (current_user_role() = 'teacher' AND created_by = auth.uid());

-- student/parent: 학원 전체 공지 + 자기(자녀) 반 공지 읽기
CREATE POLICY announcements_student_read ON announcements FOR SELECT TO authenticated
    USING (
        current_user_role() = 'student'
        AND (
            (class_id IS NULL AND academy_id = current_user_academy())
            OR class_id IN (SELECT app_my_enrolled_class_ids())
        )
    );

CREATE POLICY announcements_parent_read ON announcements FOR SELECT TO authenticated
    USING (
        current_user_role() = 'parent'
        AND (
            (class_id IS NULL AND academy_id = current_user_academy())
            OR class_id IN (SELECT app_my_child_class_ids())
        )
    );

-- ===== STUDENT_NOTES (내부용 — student/parent 정책 없음 = 접근 불가) =====
CREATE POLICY student_notes_admin_all ON student_notes FOR ALL TO authenticated
    USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY student_notes_owner_all ON student_notes FOR ALL TO authenticated
    USING (
        current_user_role() = 'owner'
        AND app_student_academy(student_id) = current_user_academy()
    )
    WITH CHECK (app_student_academy(student_id) = current_user_academy());

CREATE POLICY student_notes_teacher_read ON student_notes FOR SELECT TO authenticated
    USING (
        current_user_role() = 'teacher'
        AND student_id IN (SELECT app_my_taught_student_ids())
    );

CREATE POLICY student_notes_teacher_insert ON student_notes FOR INSERT TO authenticated
    WITH CHECK (
        current_user_role() = 'teacher'
        AND created_by = auth.uid()
        AND student_id IN (SELECT app_my_taught_student_ids())
    );

CREATE POLICY student_notes_teacher_delete ON student_notes FOR DELETE TO authenticated
    USING (current_user_role() = 'teacher' AND created_by = auth.uid());
