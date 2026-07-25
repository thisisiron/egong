-- notify_* RPC 미인증(anon) fail-open 차단 + anon EXECUTE 회수.
-- 배경: "IS DISTINCT FROM auth.uid()" 가드는 auth.uid()가 NULL(미인증)이고 비교 대상 컬럼도
--   NULL(초등생 user_id 미배정 — students.user_id nullable, 답글 author_id는 ON DELETE SET NULL)이면
--   NULL IS DISTINCT FROM NULL = FALSE → 가드 통과 → 익명 호출자가 알림을 fan-out 가능.
--   20260726000002에서 추가한 "auth.uid() IS NULL 조기 차단" 패턴을 여기 4개 RPC에도 적용한다.
-- 원본 로직(수신자·타이틀·링크·반환값)은 전혀 바꾸지 않는다 — 가드만 추가하고 NULL-불안전 비교를 명시화.
-- notify_assignment_feedback은 원래 EXISTS 기반이라 NULL-safe하지만, 조기 차단·anon 회수는 일관성을 위해 동일 적용.
-- 전부 CREATE OR REPLACE / REVOKE라 재실행해도 안전.

-- ===== notify_assignment_submitted (원본: 20260613000004_assignments.sql) =====
CREATE OR REPLACE FUNCTION public.notify_assignment_submitted(p_submission_id uuid)
RETURNS integer LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_academy_id uuid; v_class_id uuid; v_assignment_id uuid; v_student_id uuid;
        v_student_name text; v_student_user uuid; v_count int;
BEGIN
    IF auth.uid() IS NULL THEN RAISE EXCEPTION '권한이 없습니다.'; END IF;
    SELECT sub.academy_id, sub.class_id, sub.assignment_id, sub.student_id
      INTO v_academy_id, v_class_id, v_assignment_id, v_student_id
    FROM assignment_submissions sub WHERE sub.id = p_submission_id;
    IF v_academy_id IS NULL THEN RAISE EXCEPTION '제출을 찾을 수 없습니다.'; END IF;
    SELECT s.name, s.user_id INTO v_student_name, v_student_user FROM students s WHERE s.id = v_student_id;
    IF v_student_user IS NULL OR v_student_user IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION '권한이 없습니다.'; END IF;
    INSERT INTO notifications (user_id, academy_id, type, title, link, source_id)
    SELECT DISTINCT t.user_id, v_academy_id, 'assignment',
        v_student_name || ' 학생이 과제를 제출했습니다',
        '/teacher/assignments/' || v_assignment_id::text, v_assignment_id
    FROM class_teachers ct JOIN teachers t ON t.id = ct.teacher_id
    WHERE ct.class_id = v_class_id AND t.user_id IS NOT NULL;
    GET DIAGNOSTICS v_count = ROW_COUNT; RETURN v_count;
END; $$;
GRANT EXECUTE ON FUNCTION public.notify_assignment_submitted(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_assignment_submitted(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_assignment_submitted(uuid) FROM anon;

-- ===== notify_assignment_feedback (원본: 20260613000004_assignments.sql) — 이미 EXISTS 기반 NULL-safe, 일관성 위해 조기 차단만 추가 =====
CREATE OR REPLACE FUNCTION public.notify_assignment_feedback(p_submission_id uuid)
RETURNS integer LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_academy_id uuid; v_class_id uuid; v_assignment_id uuid; v_student_id uuid; v_title text; v_count int;
BEGIN
    IF auth.uid() IS NULL THEN RAISE EXCEPTION '권한이 없습니다.'; END IF;
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
REVOKE EXECUTE ON FUNCTION public.notify_assignment_feedback(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_assignment_feedback(uuid) FROM anon;

-- ===== notify_question_created (원본: 20260614000001_class_questions.sql) =====
CREATE OR REPLACE FUNCTION public.notify_question_created(p_question_id uuid)
RETURNS integer LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_academy_id uuid; v_class_id uuid; v_student_id uuid; v_student_user uuid;
        v_author_name text; v_title text; v_count int;
BEGIN
    IF auth.uid() IS NULL THEN RAISE EXCEPTION '권한이 없습니다.'; END IF;
    SELECT q.academy_id, q.class_id, q.student_id, q.author_name, q.title
      INTO v_academy_id, v_class_id, v_student_id, v_author_name, v_title
    FROM questions q WHERE q.id = p_question_id;
    IF v_academy_id IS NULL THEN RAISE EXCEPTION '질문을 찾을 수 없습니다.'; END IF;
    SELECT s.user_id INTO v_student_user FROM students s WHERE s.id = v_student_id;
    IF v_student_user IS NULL OR v_student_user IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION '권한이 없습니다.'; END IF;
    INSERT INTO notifications (user_id, academy_id, type, title, link, source_id)
    SELECT DISTINCT t.user_id, v_academy_id, 'question',
        v_author_name || ' 학생의 질문: ' || v_title,
        '/teacher/questions/' || p_question_id::text, p_question_id
    FROM class_teachers ct JOIN teachers t ON t.id = ct.teacher_id
    WHERE ct.class_id = v_class_id AND t.user_id IS NOT NULL;
    GET DIAGNOSTICS v_count = ROW_COUNT; RETURN v_count;
END; $$;
GRANT EXECUTE ON FUNCTION public.notify_question_created(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_question_created(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_question_created(uuid) FROM anon;

-- ===== notify_question_reply (원본: 20260614000001_class_questions.sql) — author_id는 ON DELETE SET NULL, 동일 NULL 위험 =====
CREATE OR REPLACE FUNCTION public.notify_question_reply(p_reply_id uuid)
RETURNS integer LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_question_id uuid; v_academy_id uuid; v_author_id uuid; v_author_name text;
        v_q_academy uuid; v_q_class uuid; v_q_student uuid; v_q_public boolean; v_q_title text;
        v_q_student_user uuid; v_count int;
BEGIN
    IF auth.uid() IS NULL THEN RAISE EXCEPTION '권한이 없습니다.'; END IF;
    SELECT r.question_id, r.academy_id, r.author_id, r.author_name
      INTO v_question_id, v_academy_id, v_author_id, v_author_name
    FROM question_replies r WHERE r.id = p_reply_id;
    IF v_question_id IS NULL THEN RAISE EXCEPTION '답글을 찾을 수 없습니다.'; END IF;
    IF v_author_id IS NULL OR v_author_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION '권한이 없습니다.'; END IF;
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
REVOKE EXECUTE ON FUNCTION public.notify_question_reply(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_question_reply(uuid) FROM anon;
