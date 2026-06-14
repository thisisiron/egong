-- 수업 질문 후속 보정 2건:
--  1) notify_question_reply 알림 링크를 수신자 역할별로 분기(스태프가 /me 링크 받던 버그)
--  2) 학생이 '자기' 질문(공개/비공개 무관)에는 답글 가능하도록 qreplies_student_insert 확대

-- ===== Fix 1: 역할별 알림 링크 =====
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
        CASE u.role
            WHEN 'teacher' THEN '/teacher/questions/' || v_question_id::text
            WHEN 'owner'   THEN '/owner/questions/'   || v_question_id::text
            ELSE '/me/questions/' || v_question_id::text
        END,
        v_question_id
    FROM recipients rc
    JOIN users u ON u.id = rc.uid
    WHERE rc.uid IS NOT NULL AND rc.uid <> v_author_id;
    GET DIAGNOSTICS v_count = ROW_COUNT; RETURN v_count;
END; $$;
GRANT EXECUTE ON FUNCTION public.notify_question_reply(uuid) TO authenticated;

-- ===== Fix 2: 학생이 자기 질문(공개/비공개)에 답글 허용 =====
DROP POLICY IF EXISTS qreplies_student_insert ON question_replies;
CREATE POLICY qreplies_student_insert ON question_replies FOR INSERT TO authenticated
    WITH CHECK (current_user_role() = 'student' AND author_id = auth.uid()
        AND academy_id = current_user_academy()
        AND question_id IN (
            SELECT id FROM questions WHERE
                (is_public OR student_id IN (SELECT app_my_student_ids()))
                AND class_id IN (SELECT app_my_enrolled_class_ids())
        ));
