-- 수업 질문(questions) + 답글(question_replies) + storage(question-files) + 알림 RPC 2종
-- DDD: 독립 도메인. 알림은 기존 notifications 테이블 재사용(type='question').
-- RLS: 기존 app_* SECURITY DEFINER 헬퍼만 사용(신규 0). 답글에 academy_id 비정규화로 RLS 단순화.
-- 첨부 경로에 question_id를 못 쓰는 이유: row 생성 전 업로드 → 경로는 {academy_id}/{uuid}.{ext} 학원 스코프.

CREATE TABLE questions (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    academy_id  uuid NOT NULL REFERENCES academy(id) ON DELETE CASCADE,
    class_id    uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    student_id  uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    author_name text NOT NULL,
    title       text NOT NULL,
    body        text NOT NULL,
    file_paths  text[] NOT NULL DEFAULT '{}',
    is_public   boolean NOT NULL DEFAULT false,
    is_resolved boolean NOT NULL DEFAULT false,
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_questions_class ON questions(class_id);
CREATE INDEX idx_questions_academy ON questions(academy_id);
CREATE INDEX idx_questions_student ON questions(student_id);

CREATE TABLE question_replies (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    academy_id  uuid NOT NULL REFERENCES academy(id) ON DELETE CASCADE,
    author_id   uuid REFERENCES users(id) ON DELETE SET NULL,
    author_role text NOT NULL,            -- 'teacher' | 'owner' | 'student'
    author_name text NOT NULL,
    body        text NOT NULL,
    file_paths  text[] NOT NULL DEFAULT '{}',
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_qreplies_question ON question_replies(question_id);

ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_replies ENABLE ROW LEVEL SECURITY;

-- ===== questions =====
CREATE POLICY questions_admin_all ON questions FOR ALL TO authenticated
    USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY questions_owner_all ON questions FOR ALL TO authenticated
    USING (current_user_role() = 'owner' AND academy_id = current_user_academy())
    WITH CHECK (current_user_role() = 'owner' AND academy_id = current_user_academy());
CREATE POLICY questions_teacher_read ON questions FOR SELECT TO authenticated
    USING (current_user_role() = 'teacher' AND class_id IN (SELECT app_my_taught_class_ids()));
CREATE POLICY questions_teacher_update ON questions FOR UPDATE TO authenticated
    USING (current_user_role() = 'teacher' AND class_id IN (SELECT app_my_taught_class_ids()))
    WITH CHECK (current_user_role() = 'teacher' AND class_id IN (SELECT app_my_taught_class_ids()));
CREATE POLICY questions_student_read ON questions FOR SELECT TO authenticated
    USING (current_user_role() = 'student' AND (
        student_id IN (SELECT app_my_student_ids())
        OR (is_public AND class_id IN (SELECT app_my_enrolled_class_ids()))
    ));
CREATE POLICY questions_student_insert ON questions FOR INSERT TO authenticated
    WITH CHECK (current_user_role() = 'student'
        AND student_id IN (SELECT app_my_student_ids())
        AND academy_id = current_user_academy()
        AND class_id IN (SELECT app_my_enrolled_class_ids()));
CREATE POLICY questions_student_update ON questions FOR UPDATE TO authenticated
    USING (current_user_role() = 'student' AND student_id IN (SELECT app_my_student_ids()))
    WITH CHECK (student_id IN (SELECT app_my_student_ids()));
CREATE POLICY questions_parent_read ON questions FOR SELECT TO authenticated
    USING (current_user_role() = 'parent' AND (
        student_id IN (SELECT app_my_child_student_ids())
        OR (is_public AND class_id IN (SELECT app_my_child_class_ids()))
    ));

-- ===== question_replies (부모 질문을 볼 수 있으면 답글도 볼 수 있게) =====
CREATE POLICY qreplies_admin_all ON question_replies FOR ALL TO authenticated
    USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY qreplies_owner_all ON question_replies FOR ALL TO authenticated
    USING (current_user_role() = 'owner' AND academy_id = current_user_academy())
    WITH CHECK (current_user_role() = 'owner' AND academy_id = current_user_academy());
CREATE POLICY qreplies_teacher_read ON question_replies FOR SELECT TO authenticated
    USING (current_user_role() = 'teacher'
        AND question_id IN (SELECT id FROM questions WHERE class_id IN (SELECT app_my_taught_class_ids())));
CREATE POLICY qreplies_teacher_insert ON question_replies FOR INSERT TO authenticated
    WITH CHECK (current_user_role() = 'teacher' AND author_id = auth.uid()
        AND academy_id = current_user_academy()
        AND question_id IN (SELECT id FROM questions WHERE class_id IN (SELECT app_my_taught_class_ids())));
CREATE POLICY qreplies_student_read ON question_replies FOR SELECT TO authenticated
    USING (current_user_role() = 'student'
        AND question_id IN (
            SELECT id FROM questions WHERE
                student_id IN (SELECT app_my_student_ids())
                OR (is_public AND class_id IN (SELECT app_my_enrolled_class_ids()))
        ));
CREATE POLICY qreplies_student_insert ON question_replies FOR INSERT TO authenticated
    WITH CHECK (current_user_role() = 'student' AND author_id = auth.uid()
        AND academy_id = current_user_academy()
        AND question_id IN (
            SELECT id FROM questions WHERE is_public AND class_id IN (SELECT app_my_enrolled_class_ids())
        ));
CREATE POLICY qreplies_parent_read ON question_replies FOR SELECT TO authenticated
    USING (current_user_role() = 'parent'
        AND question_id IN (
            SELECT id FROM questions WHERE
                student_id IN (SELECT app_my_child_student_ids())
                OR (is_public AND class_id IN (SELECT app_my_child_class_ids()))
        ));

-- ===== Storage 버킷 + RLS (학원 스코프 단일 정책) =====
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('question-files', 'question-files', false, 10 * 1024 * 1024,
        ARRAY['image/png','image/jpeg','application/pdf']::text[])
ON CONFLICT (id) DO UPDATE SET file_size_limit = EXCLUDED.file_size_limit,
        allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY qfiles_academy_all ON storage.objects FOR ALL TO authenticated
    USING (bucket_id = 'question-files'
        AND (storage.foldername(name))[1] = current_user_academy()::text)
    WITH CHECK (bucket_id = 'question-files'
        AND (storage.foldername(name))[1] = current_user_academy()::text);
CREATE POLICY qfiles_admin_all ON storage.objects FOR ALL TO authenticated
    USING (bucket_id = 'question-files' AND is_admin())
    WITH CHECK (bucket_id = 'question-files' AND is_admin());

-- ===== 알림 RPC 2종 (과제 RPC와 동형) =====
CREATE OR REPLACE FUNCTION public.notify_question_created(p_question_id uuid)
RETURNS integer LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_academy_id uuid; v_class_id uuid; v_student_id uuid; v_student_user uuid;
        v_author_name text; v_title text; v_count int;
BEGIN
    SELECT q.academy_id, q.class_id, q.student_id, q.author_name, q.title
      INTO v_academy_id, v_class_id, v_student_id, v_author_name, v_title
    FROM questions q WHERE q.id = p_question_id;
    IF v_academy_id IS NULL THEN RAISE EXCEPTION '질문을 찾을 수 없습니다.'; END IF;
    SELECT s.user_id INTO v_student_user FROM students s WHERE s.id = v_student_id;
    IF v_student_user IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION '권한이 없습니다.'; END IF;
    INSERT INTO notifications (user_id, academy_id, type, title, link, source_id)
    SELECT DISTINCT t.user_id, v_academy_id, 'question',
        v_author_name || ' 학생의 질문: ' || v_title,
        '/teacher/questions/' || p_question_id::text, p_question_id
    FROM class_teachers ct JOIN teachers t ON t.id = ct.teacher_id
    WHERE ct.class_id = v_class_id AND t.user_id IS NOT NULL;
    GET DIAGNOSTICS v_count = ROW_COUNT; RETURN v_count;
END; $$;
GRANT EXECUTE ON FUNCTION public.notify_question_created(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.notify_question_reply(p_reply_id uuid)
RETURNS integer LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_question_id uuid; v_academy_id uuid; v_author_id uuid; v_author_name text;
        v_q_academy uuid; v_q_class uuid; v_q_student uuid; v_q_public boolean; v_q_title text;
        v_q_student_user uuid; v_count int;
BEGIN
    SELECT r.question_id, r.academy_id, r.author_id, r.author_name
      INTO v_question_id, v_academy_id, v_author_id, v_author_name
    FROM question_replies r WHERE r.id = p_reply_id;
    IF v_question_id IS NULL THEN RAISE EXCEPTION '답글을 찾을 수 없습니다.'; END IF;
    IF v_author_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION '권한이 없습니다.'; END IF;
    SELECT q.academy_id, q.class_id, q.student_id, q.is_public, q.title
      INTO v_q_academy, v_q_class, v_q_student, v_q_public, v_q_title
    FROM questions q WHERE q.id = v_question_id;
    SELECT s.user_id INTO v_q_student_user FROM students s WHERE s.id = v_q_student;

    WITH recipients AS (
        SELECT v_q_student_user AS uid
        UNION
        SELECT r2.author_id FROM question_replies r2
          WHERE v_q_public AND r2.question_id = v_question_id
    )
    INSERT INTO notifications (user_id, academy_id, type, title, link, source_id)
    SELECT DISTINCT rc.uid, v_q_academy, 'question',
        v_author_name || '님이 답글을 남겼습니다: ' || v_q_title,
        '/me/questions/' || v_question_id::text, v_question_id
    FROM recipients rc
    WHERE rc.uid IS NOT NULL AND rc.uid <> v_author_id;
    GET DIAGNOSTICS v_count = ROW_COUNT; RETURN v_count;
END; $$;
GRANT EXECUTE ON FUNCTION public.notify_question_reply(uuid) TO authenticated;
