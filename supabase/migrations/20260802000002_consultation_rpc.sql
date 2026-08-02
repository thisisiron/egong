-- 상담 상태 전이 + 알림. RLS가 아니라 여기서 전이 규칙을 강제한다.
--
-- 알림 INSERT를 상태 전이와 같은 트랜잭션에 두는 이유: 상태만 바뀌고 알림이 누락되는
-- 경우를 구조적으로 없앤다. app_fanout_scope_notifications 헬퍼는 쓰지 않는다 —
-- 그건 "역할 그룹 ∩ 반/학원 범위" 수신자용이고, 상담은 개인(신청 학부모) 또는
-- 학원 스태프 전원이라 규칙이 다르다(notify_assignment_submitted와 같은 부류).
--
-- 낙관적 잠금: UPDATE ... WHERE status = <기대값> + ROW_COUNT 검사. 두 선생님이 동시에
-- 확정을 눌러도 실제로 행을 갱신한 쪽만 성공하고, 진 쪽은 명확한 메시지를 받는다.

-- ===== 신청 (학부모) =====
-- INSERT + 이름 스냅샷 해석 + 스태프 알림을 한 트랜잭션으로. RLS INSERT 정책을 두지
-- 않는 이유는 20260802000001의 주석 참고.
CREATE OR REPLACE FUNCTION public.request_consultation(
    p_student_id uuid, p_preferred_date date, p_preferred_slot text, p_reason text)
RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_academy_id uuid; v_parent_id uuid; v_student_name text; v_parent_name text;
    v_id uuid;
BEGIN
    IF auth.uid() IS NULL THEN RAISE EXCEPTION '권한이 없습니다.'; END IF;

    -- 가드: 내 자녀인가 (SECURITY DEFINER 안에서도 auth.uid()는 호출자다)
    IF NOT (p_student_id IN (SELECT app_my_child_student_ids())) THEN
        RAISE EXCEPTION '내 자녀가 아닙니다.';
    END IF;

    SELECT s.academy_id, s.name INTO v_academy_id, v_student_name
    FROM students s WHERE s.id = p_student_id;
    IF v_academy_id IS NULL THEN RAISE EXCEPTION '학생을 찾을 수 없습니다.'; END IF;

    -- 호출자 본인의 parent 행. 자녀에 학부모가 둘이어도 신청자를 잃지 않는다.
    SELECT p.id, p.name INTO v_parent_id, v_parent_name
    FROM parents p
    JOIN student_parent sp ON sp.parent_id = p.id
    WHERE p.user_id = auth.uid() AND sp.student_id = p_student_id
    LIMIT 1;
    IF v_parent_id IS NULL THEN RAISE EXCEPTION '권한이 없습니다.'; END IF;

    IF p_preferred_slot NOT IN ('morning','afternoon','evening') THEN
        RAISE EXCEPTION '희망 시간대를 선택해주세요.';
    END IF;
    IF p_reason IS NULL OR btrim(p_reason) = '' THEN
        RAISE EXCEPTION '상담 사유를 입력해주세요.';
    END IF;
    -- KST 기준 내일 이후만. now()는 UTC이므로 +9h 해서 날짜를 비교한다.
    IF p_preferred_date <= ((now() AT TIME ZONE 'Asia/Seoul')::date) THEN
        RAISE EXCEPTION '내일 이후 날짜를 선택해주세요.';
    END IF;

    INSERT INTO consultations (
        academy_id, student_id, parent_id, preferred_date, preferred_slot,
        reason, student_name, parent_name)
    VALUES (
        v_academy_id, p_student_id, v_parent_id, p_preferred_date, p_preferred_slot,
        btrim(p_reason), v_student_name, v_parent_name)
    RETURNING id INTO v_id;

    INSERT INTO notifications (user_id, academy_id, type, title, link, source_id)
    SELECT u.id, v_academy_id, 'consultation',
           v_student_name || ' 학부모 상담 신청',
           CASE u.role WHEN 'owner' THEN '/owner/consultations'
                       ELSE '/teacher/consultations' END,
           v_id
    FROM users u
    WHERE u.academy_id = v_academy_id AND u.role IN ('owner','teacher');

    RETURN v_id;
END; $$;

GRANT EXECUTE ON FUNCTION public.request_consultation(uuid, date, text, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.request_consultation(uuid, date, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.request_consultation(uuid, date, text, text) FROM anon;

-- ===== 확정 =====
CREATE OR REPLACE FUNCTION public.confirm_consultation(
    p_id uuid, p_scheduled_at timestamptz, p_note text DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_academy_id uuid; v_parent_user uuid; v_student_name text;
    v_handler text; v_n int;
BEGIN
    IF auth.uid() IS NULL THEN RAISE EXCEPTION '권한이 없습니다.'; END IF;

    -- 학생 이름은 스냅샷에서 읽는다 — students 조인은 teacher RLS 범위에 걸린다.
    SELECT c.academy_id, p.user_id, c.student_name
      INTO v_academy_id, v_parent_user, v_student_name
    FROM consultations c
    JOIN parents p ON p.id = c.parent_id
    WHERE c.id = p_id;
    IF v_academy_id IS NULL THEN RAISE EXCEPTION '상담 요청을 찾을 수 없습니다.'; END IF;

    -- 가드 + handler_name 스냅샷을 한 번에. 같은 학원 owner/teacher가 아니면 NULL.
    SELECT u.display_name INTO v_handler
    FROM users u
    WHERE u.id = auth.uid()
      AND u.role IN ('owner','teacher')
      AND u.academy_id = v_academy_id;
    IF v_handler IS NULL THEN RAISE EXCEPTION '권한이 없습니다.'; END IF;

    IF p_scheduled_at IS NULL THEN RAISE EXCEPTION '상담 시각을 입력해주세요.'; END IF;
    IF p_scheduled_at <= now() THEN RAISE EXCEPTION '지난 시각으로는 확정할 수 없습니다.'; END IF;

    UPDATE consultations
       SET status = 'confirmed', scheduled_at = p_scheduled_at,
           handled_by = auth.uid(), handler_name = v_handler,
           response_note = p_note, responded_at = now(), updated_at = now()
     WHERE id = p_id AND status = 'requested';
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n = 0 THEN RAISE EXCEPTION '이미 처리된 상담 요청입니다.'; END IF;

    -- parents.user_id는 NULL일 수 있다(계정 미발급 학부모)
    IF v_parent_user IS NOT NULL THEN
        INSERT INTO notifications (user_id, academy_id, type, title, link, source_id)
        VALUES (v_parent_user, v_academy_id, 'consultation',
                v_student_name || ' 상담이 확정되었습니다',
                '/me/consultations', p_id);
    END IF;

    RETURN 1;
END; $$;

GRANT EXECUTE ON FUNCTION public.confirm_consultation(uuid, timestamptz, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.confirm_consultation(uuid, timestamptz, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.confirm_consultation(uuid, timestamptz, text) FROM anon;

-- ===== 반려 =====
CREATE OR REPLACE FUNCTION public.reject_consultation(p_id uuid, p_note text)
RETURNS integer LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_academy_id uuid; v_parent_user uuid; v_student_name text;
    v_handler text; v_n int;
BEGIN
    IF auth.uid() IS NULL THEN RAISE EXCEPTION '권한이 없습니다.'; END IF;

    SELECT c.academy_id, p.user_id, c.student_name
      INTO v_academy_id, v_parent_user, v_student_name
    FROM consultations c
    JOIN parents p ON p.id = c.parent_id
    WHERE c.id = p_id;
    IF v_academy_id IS NULL THEN RAISE EXCEPTION '상담 요청을 찾을 수 없습니다.'; END IF;

    SELECT u.display_name INTO v_handler
    FROM users u
    WHERE u.id = auth.uid()
      AND u.role IN ('owner','teacher')
      AND u.academy_id = v_academy_id;
    IF v_handler IS NULL THEN RAISE EXCEPTION '권한이 없습니다.'; END IF;

    IF p_note IS NULL OR btrim(p_note) = '' THEN
        RAISE EXCEPTION '반려 사유를 입력해주세요.';
    END IF;

    UPDATE consultations
       SET status = 'rejected', handled_by = auth.uid(), handler_name = v_handler,
           response_note = p_note, responded_at = now(), updated_at = now()
     WHERE id = p_id AND status = 'requested';
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n = 0 THEN RAISE EXCEPTION '이미 처리된 상담 요청입니다.'; END IF;

    IF v_parent_user IS NOT NULL THEN
        INSERT INTO notifications (user_id, academy_id, type, title, link, source_id)
        VALUES (v_parent_user, v_academy_id, 'consultation',
                v_student_name || ' 상담 신청이 반려되었습니다',
                '/me/consultations', p_id);
    END IF;

    RETURN 1;
END; $$;

GRANT EXECUTE ON FUNCTION public.reject_consultation(uuid, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.reject_consultation(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reject_consultation(uuid, text) FROM anon;

-- ===== 취소 (학부모 본인 또는 학원 스태프) =====
CREATE OR REPLACE FUNCTION public.cancel_consultation(p_id uuid, p_note text DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_academy_id uuid; v_parent_id uuid; v_parent_user uuid; v_student_name text;
    v_actor_name text; v_is_staff boolean; v_is_parent boolean; v_n int;
BEGIN
    IF auth.uid() IS NULL THEN RAISE EXCEPTION '권한이 없습니다.'; END IF;

    SELECT c.academy_id, c.parent_id, p.user_id, c.student_name
      INTO v_academy_id, v_parent_id, v_parent_user, v_student_name
    FROM consultations c
    JOIN parents p ON p.id = c.parent_id
    WHERE c.id = p_id;
    IF v_academy_id IS NULL THEN RAISE EXCEPTION '상담 요청을 찾을 수 없습니다.'; END IF;

    SELECT EXISTS (
        SELECT 1 FROM users u
        WHERE u.id = auth.uid()
          AND u.role IN ('owner','teacher')
          AND u.academy_id = v_academy_id
    ) INTO v_is_staff;
    v_is_parent := v_parent_id IN (SELECT app_my_parent_ids());

    IF NOT (v_is_staff OR v_is_parent) THEN RAISE EXCEPTION '권한이 없습니다.'; END IF;

    SELECT display_name INTO v_actor_name FROM users WHERE id = auth.uid();

    UPDATE consultations
       SET status = 'cancelled', handled_by = auth.uid(), handler_name = v_actor_name,
           response_note = p_note, responded_at = now(), updated_at = now()
     WHERE id = p_id AND status IN ('requested','confirmed');
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n = 0 THEN RAISE EXCEPTION '이미 처리된 상담 요청입니다.'; END IF;

    IF v_is_staff THEN
        -- 학원이 취소 → 학부모에게
        IF v_parent_user IS NOT NULL THEN
            INSERT INTO notifications (user_id, academy_id, type, title, link, source_id)
            VALUES (v_parent_user, v_academy_id, 'consultation',
                    v_student_name || ' 상담이 취소되었습니다',
                    '/me/consultations', p_id);
        END IF;
        RETURN 1;
    END IF;

    -- 학부모가 취소 → 학원 스태프 전원에게
    INSERT INTO notifications (user_id, academy_id, type, title, link, source_id)
    SELECT u.id, v_academy_id, 'consultation',
           v_student_name || ' 학부모가 상담을 취소했습니다',
           CASE u.role WHEN 'owner' THEN '/owner/consultations'
                       ELSE '/teacher/consultations' END,
           p_id
    FROM users u
    WHERE u.academy_id = v_academy_id AND u.role IN ('owner','teacher');
    RETURN 1;
END; $$;

GRANT EXECUTE ON FUNCTION public.cancel_consultation(uuid, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.cancel_consultation(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cancel_consultation(uuid, text) FROM anon;
