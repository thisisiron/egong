-- 과제(assignments) + 제출(assignment_submissions) + 제출물 storage + 알림 RPC 3종
-- DDD: 독립 도메인. 알림은 기존 notifications 테이블 재사용(type='assignment').
-- RLS: 기존 app_* SECURITY DEFINER 헬퍼만 사용(신규 0). 제출에 academy_id/class_id 비정규화로 RLS 단순화.

CREATE TABLE assignments (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    academy_id  uuid NOT NULL REFERENCES academy(id) ON DELETE CASCADE,
    class_id    uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    title       text NOT NULL,
    description text,
    due_at      timestamptz,
    created_by  uuid REFERENCES users(id) ON DELETE SET NULL,
    author_name text NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_assignments_class ON assignments(class_id);
CREATE INDEX idx_assignments_academy ON assignments(academy_id);

CREATE TABLE assignment_submissions (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id    uuid NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
    student_id       uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    academy_id       uuid NOT NULL REFERENCES academy(id) ON DELETE CASCADE,
    class_id         uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    memo             text,
    file_paths       text[] NOT NULL DEFAULT '{}',
    submitted_at     timestamptz NOT NULL DEFAULT now(),
    score            text,
    feedback         text,
    feedback_by      uuid REFERENCES users(id) ON DELETE SET NULL,
    feedback_by_name text,
    feedback_at      timestamptz,
    UNIQUE (assignment_id, student_id)
);
CREATE INDEX idx_submissions_assignment ON assignment_submissions(assignment_id);
CREATE INDEX idx_submissions_student ON assignment_submissions(student_id);

ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_submissions ENABLE ROW LEVEL SECURITY;

-- ===== assignments (공지와 동형) =====
CREATE POLICY assignments_admin_all ON assignments FOR ALL TO authenticated
    USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY assignments_owner_all ON assignments FOR ALL TO authenticated
    USING (current_user_role() = 'owner' AND academy_id = current_user_academy())
    WITH CHECK (current_user_role() = 'owner' AND academy_id = current_user_academy());
CREATE POLICY assignments_teacher_read ON assignments FOR SELECT TO authenticated
    USING (current_user_role() = 'teacher' AND class_id IN (SELECT app_my_taught_class_ids()));
CREATE POLICY assignments_teacher_insert ON assignments FOR INSERT TO authenticated
    WITH CHECK (current_user_role() = 'teacher' AND created_by = auth.uid()
        AND academy_id = current_user_academy() AND class_id IN (SELECT app_my_taught_class_ids()));
CREATE POLICY assignments_teacher_update ON assignments FOR UPDATE TO authenticated
    USING (current_user_role() = 'teacher' AND created_by = auth.uid())
    WITH CHECK (created_by = auth.uid() AND class_id IN (SELECT app_my_taught_class_ids()));
CREATE POLICY assignments_teacher_delete ON assignments FOR DELETE TO authenticated
    USING (current_user_role() = 'teacher' AND created_by = auth.uid());
CREATE POLICY assignments_student_read ON assignments FOR SELECT TO authenticated
    USING (current_user_role() = 'student' AND class_id IN (SELECT app_my_enrolled_class_ids()));
CREATE POLICY assignments_parent_read ON assignments FOR SELECT TO authenticated
    USING (current_user_role() = 'parent' AND class_id IN (SELECT app_my_child_class_ids()));

-- ===== assignment_submissions =====
CREATE POLICY asub_admin_all ON assignment_submissions FOR ALL TO authenticated
    USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY asub_owner_all ON assignment_submissions FOR ALL TO authenticated
    USING (current_user_role() = 'owner' AND academy_id = current_user_academy())
    WITH CHECK (current_user_role() = 'owner' AND academy_id = current_user_academy());
CREATE POLICY asub_student_select ON assignment_submissions FOR SELECT TO authenticated
    USING (current_user_role() = 'student' AND student_id IN (SELECT app_my_student_ids()));
CREATE POLICY asub_student_insert ON assignment_submissions FOR INSERT TO authenticated
    WITH CHECK (current_user_role() = 'student' AND student_id IN (SELECT app_my_student_ids())
        AND academy_id = current_user_academy());
CREATE POLICY asub_student_update ON assignment_submissions FOR UPDATE TO authenticated
    USING (current_user_role() = 'student' AND student_id IN (SELECT app_my_student_ids()))
    WITH CHECK (student_id IN (SELECT app_my_student_ids()));
CREATE POLICY asub_parent_select ON assignment_submissions FOR SELECT TO authenticated
    USING (current_user_role() = 'parent' AND student_id IN (SELECT app_my_child_student_ids()));
CREATE POLICY asub_teacher_select ON assignment_submissions FOR SELECT TO authenticated
    USING (current_user_role() = 'teacher' AND class_id IN (SELECT app_my_taught_class_ids()));
CREATE POLICY asub_teacher_update ON assignment_submissions FOR UPDATE TO authenticated
    USING (current_user_role() = 'teacher' AND class_id IN (SELECT app_my_taught_class_ids()))
    WITH CHECK (class_id IN (SELECT app_my_taught_class_ids()));

-- ===== Storage 버킷 + RLS (사업자서류 선례 패턴) =====
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('assignment-submissions', 'assignment-submissions', false, 10 * 1024 * 1024,
        ARRAY['image/png','image/jpeg','application/pdf']::text[])
ON CONFLICT (id) DO UPDATE SET file_size_limit = EXCLUDED.file_size_limit,
        allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 경로: {academy_id}/{assignment_id}/{student_id}/{uuid}.{ext} → foldername[1]=academy, [3]=student
CREATE POLICY asub_storage_student_all ON storage.objects FOR ALL TO authenticated
    USING (bucket_id = 'assignment-submissions'
        AND ((storage.foldername(name))[3])::uuid IN (SELECT app_my_student_ids()))
    WITH CHECK (bucket_id = 'assignment-submissions'
        AND ((storage.foldername(name))[3])::uuid IN (SELECT app_my_student_ids()));
CREATE POLICY asub_storage_parent_read ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'assignment-submissions'
        AND ((storage.foldername(name))[3])::uuid IN (SELECT app_my_child_student_ids()));
CREATE POLICY asub_storage_teacher_read ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'assignment-submissions'
        AND ((storage.foldername(name))[3])::uuid IN (SELECT app_my_taught_student_ids()));
CREATE POLICY asub_storage_owner_read ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'assignment-submissions'
        AND (storage.foldername(name))[1] = current_user_academy()::text);
CREATE POLICY asub_storage_admin_all ON storage.objects FOR ALL TO authenticated
    USING (bucket_id = 'assignment-submissions' AND is_admin())
    WITH CHECK (bucket_id = 'assignment-submissions' AND is_admin());

-- ===== 알림 RPC 3종 (공지 create_announcement_notifications와 동형) =====
CREATE OR REPLACE FUNCTION public.create_assignment_notifications(p_assignment_id uuid, p_roles text[])
RETURNS integer LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_academy_id uuid; v_class_id uuid; v_title text; v_created_by uuid; v_count int;
BEGIN
    SELECT academy_id, class_id, title, created_by INTO v_academy_id, v_class_id, v_title, v_created_by
    FROM assignments WHERE id = p_assignment_id;
    IF v_academy_id IS NULL THEN RAISE EXCEPTION '과제를 찾을 수 없습니다.'; END IF;
    IF NOT (v_created_by = auth.uid() OR EXISTS (
        SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'owner' AND u.academy_id = v_academy_id
    )) THEN RAISE EXCEPTION '권한이 없습니다.'; END IF;
    WITH recipients AS (
        SELECT s.user_id AS uid FROM students s
          WHERE 'student' = ANY(p_roles) AND s.user_id IS NOT NULL
            AND s.id IN (SELECT cs.student_id FROM class_students cs WHERE cs.class_id = v_class_id AND cs.left_at IS NULL)
        UNION
        SELECT p.user_id FROM parents p
          JOIN student_parent sp ON sp.parent_id = p.id
          JOIN students s ON s.id = sp.student_id
          WHERE 'parent' = ANY(p_roles)
            AND s.id IN (SELECT cs.student_id FROM class_students cs WHERE cs.class_id = v_class_id AND cs.left_at IS NULL)
    )
    INSERT INTO notifications (user_id, academy_id, type, title, link, source_id)
    SELECT DISTINCT r.uid, v_academy_id, 'assignment', '새 과제: ' || v_title,
        '/me/assignments/' || p_assignment_id::text, p_assignment_id
    FROM recipients r WHERE r.uid IS NOT NULL AND (v_created_by IS NULL OR r.uid <> v_created_by);
    GET DIAGNOSTICS v_count = ROW_COUNT; RETURN v_count;
END; $$;
GRANT EXECUTE ON FUNCTION public.create_assignment_notifications(uuid, text[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.notify_assignment_submitted(p_submission_id uuid)
RETURNS integer LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_academy_id uuid; v_class_id uuid; v_assignment_id uuid; v_student_id uuid;
        v_student_name text; v_student_user uuid; v_count int;
BEGIN
    SELECT sub.academy_id, sub.class_id, sub.assignment_id, sub.student_id
      INTO v_academy_id, v_class_id, v_assignment_id, v_student_id
    FROM assignment_submissions sub WHERE sub.id = p_submission_id;
    IF v_academy_id IS NULL THEN RAISE EXCEPTION '제출을 찾을 수 없습니다.'; END IF;
    SELECT s.name, s.user_id INTO v_student_name, v_student_user FROM students s WHERE s.id = v_student_id;
    IF v_student_user IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION '권한이 없습니다.'; END IF;
    INSERT INTO notifications (user_id, academy_id, type, title, link, source_id)
    SELECT DISTINCT t.user_id, v_academy_id, 'assignment',
        v_student_name || ' 학생이 과제를 제출했습니다',
        '/teacher/assignments/' || v_assignment_id::text, v_assignment_id
    FROM class_teachers ct JOIN teachers t ON t.id = ct.teacher_id
    WHERE ct.class_id = v_class_id AND t.user_id IS NOT NULL;
    GET DIAGNOSTICS v_count = ROW_COUNT; RETURN v_count;
END; $$;
GRANT EXECUTE ON FUNCTION public.notify_assignment_submitted(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.notify_assignment_feedback(p_submission_id uuid)
RETURNS integer LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_academy_id uuid; v_class_id uuid; v_assignment_id uuid; v_student_id uuid; v_title text; v_count int;
BEGIN
    SELECT sub.academy_id, sub.class_id, sub.assignment_id, sub.student_id, a.title
      INTO v_academy_id, v_class_id, v_assignment_id, v_student_id, v_title
    FROM assignment_submissions sub JOIN assignments a ON a.id = sub.assignment_id
    WHERE sub.id = p_submission_id;
    IF v_academy_id IS NULL THEN RAISE EXCEPTION '제출을 찾을 수 없습니다.'; END IF;
    IF NOT (
        EXISTS (SELECT 1 FROM class_teachers ct JOIN teachers t ON t.id = ct.teacher_id
                WHERE ct.class_id = v_class_id AND t.user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'owner' AND u.academy_id = v_academy_id)
    ) THEN RAISE EXCEPTION '권한이 없습니다.'; END IF;
    WITH recipients AS (
        SELECT s.user_id AS uid FROM students s WHERE s.id = v_student_id AND s.user_id IS NOT NULL
        UNION
        SELECT p.user_id FROM parents p JOIN student_parent sp ON sp.parent_id = p.id WHERE sp.student_id = v_student_id
    )
    INSERT INTO notifications (user_id, academy_id, type, title, link, source_id)
    SELECT DISTINCT r.uid, v_academy_id, 'assignment', '과제 피드백이 등록되었습니다: ' || v_title,
        '/me/assignments/' || v_assignment_id::text, v_assignment_id
    FROM recipients r WHERE r.uid IS NOT NULL;
    GET DIAGNOSTICS v_count = ROW_COUNT; RETURN v_count;
END; $$;
GRANT EXECUTE ON FUNCTION public.notify_assignment_feedback(uuid) TO authenticated;
