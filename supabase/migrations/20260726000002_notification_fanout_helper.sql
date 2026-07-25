-- 알림 fan-out 공용 헬퍼 추출 + 자료 알림 RPC 추가 + 기존 공지·과제 RPC를 헬퍼 호출로 축약.
-- 목적: create_announcement_notifications / create_assignment_notifications에 복붙돼 있던
--       "역할 그룹 ∩ 범위" 수신자 해석 SQL을 한 곳으로 모은다(자료 추가하며 기존 중복 제거).
-- 범위 밖: notify_assignment_submitted/feedback, notify_question_created/reply
--          (수신자 규칙이 근본적으로 다름 — 담당 선생만 / 질문 참여자).
--
-- 보안: 헬퍼는 임의 title·link로 아무에게나 알림을 꽂을 수 있으므로 authenticated에 EXECUTE를
--       주지 않는다(REVOKE). 가드를 가진 래퍼(definer, postgres 소유)만 호출한다.

CREATE OR REPLACE FUNCTION public.app_fanout_scope_notifications(
    p_academy_id   uuid,
    p_class_id     uuid,     -- NULL = 학원 전체
    p_roles        text[],
    p_type         text,
    p_title        text,
    p_source_id    uuid,
    p_exclude_user uuid,
    p_link_owner   text,
    p_link_teacher text,
    p_link_me      text
) RETURNS integer
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count int;
BEGIN
    WITH recipients AS (
        -- 학생 (user_id 있는 재원생만)
        SELECT s.user_id AS uid
        FROM students s
        WHERE 'student' = ANY(p_roles)
          AND s.user_id IS NOT NULL
          AND (
            (p_class_id IS NULL AND s.academy_id = p_academy_id)
            OR s.id IN (SELECT cs.student_id FROM class_students cs
                        WHERE cs.class_id = p_class_id AND cs.left_at IS NULL)
          )
        UNION
        -- 학부모 (대상 학생들의 학부모)
        SELECT p.user_id
        FROM parents p
        JOIN student_parent sp ON sp.parent_id = p.id
        JOIN students s ON s.id = sp.student_id
        WHERE 'parent' = ANY(p_roles)
          AND (
            (p_class_id IS NULL AND s.academy_id = p_academy_id)
            OR s.id IN (SELECT cs.student_id FROM class_students cs
                        WHERE cs.class_id = p_class_id AND cs.left_at IS NULL)
          )
        UNION
        -- 선생 (반별이면 담당, 전체면 학원 전체)
        SELECT t.user_id
        FROM teachers t
        WHERE 'teacher' = ANY(p_roles)
          AND (
            (p_class_id IS NULL AND t.academy_id = p_academy_id)
            OR t.id IN (SELECT ct.teacher_id FROM class_teachers ct WHERE ct.class_id = p_class_id)
          )
        UNION
        -- 원장
        SELECT u.id
        FROM users u
        WHERE 'owner' = ANY(p_roles) AND u.role = 'owner' AND u.academy_id = p_academy_id
    )
    INSERT INTO notifications (user_id, academy_id, type, title, link, source_id)
    SELECT DISTINCT r.uid, p_academy_id, p_type, p_title,
        CASE u.role
            WHEN 'owner' THEN p_link_owner
            WHEN 'teacher' THEN p_link_teacher
            ELSE p_link_me
        END,
        p_source_id
    FROM recipients r
    JOIN users u ON u.id = r.uid
    WHERE r.uid IS NOT NULL AND (p_exclude_user IS NULL OR r.uid <> p_exclude_user);

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END; $$;

-- Postgres는 기본적으로 PUBLIC에 EXECUTE를 부여하므로 반드시 회수.
REVOKE EXECUTE ON FUNCTION public.app_fanout_scope_notifications(
    uuid, uuid, text[], text, text, uuid, uuid, text, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.app_fanout_scope_notifications(
    uuid, uuid, text[], text, text, uuid, uuid, text, text, text) FROM authenticated;

-- ===== 자료 알림 (신규) =====
CREATE OR REPLACE FUNCTION public.create_material_notifications(p_material_id uuid, p_roles text[])
RETURNS integer LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_academy_id uuid; v_class_id uuid; v_title text; v_created_by uuid;
BEGIN
    SELECT academy_id, class_id, title, created_by
      INTO v_academy_id, v_class_id, v_title, v_created_by
    FROM materials WHERE id = p_material_id;
    IF v_academy_id IS NULL THEN RAISE EXCEPTION '자료를 찾을 수 없습니다.'; END IF;
    -- 가드: 작성자 본인 또는 그 학원 스태프(owner·teacher parity)
    IF NOT (v_created_by = auth.uid() OR EXISTS (
        SELECT 1 FROM users u WHERE u.id = auth.uid()
          AND u.role IN ('owner','teacher') AND u.academy_id = v_academy_id
    )) THEN RAISE EXCEPTION '권한이 없습니다.'; END IF;

    RETURN app_fanout_scope_notifications(
        v_academy_id, v_class_id, p_roles, 'material', '새 자료: ' || v_title,
        p_material_id, v_created_by,
        '/owner/materials', '/teacher/materials', '/me/materials');
END; $$;
GRANT EXECUTE ON FUNCTION public.create_material_notifications(uuid, text[]) TO authenticated;

-- ===== 공지 RPC 리팩터 (가드·링크·타이틀 동작 불변) =====
CREATE OR REPLACE FUNCTION public.create_announcement_notifications(p_announcement_id uuid, p_roles text[])
RETURNS integer LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_academy_id uuid; v_class_id uuid; v_title text; v_created_by uuid;
BEGIN
    SELECT academy_id, class_id, title, created_by
      INTO v_academy_id, v_class_id, v_title, v_created_by
    FROM announcements WHERE id = p_announcement_id;
    IF v_academy_id IS NULL THEN RAISE EXCEPTION '공지를 찾을 수 없습니다.'; END IF;
    IF NOT (v_created_by = auth.uid() OR EXISTS (
        SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'owner' AND u.academy_id = v_academy_id
    )) THEN RAISE EXCEPTION '권한이 없습니다.'; END IF;

    RETURN app_fanout_scope_notifications(
        v_academy_id, v_class_id, p_roles, 'announcement', v_title,
        p_announcement_id, v_created_by,
        '/owner/announcements', '/teacher/announcements', '/me/board');
END; $$;

-- ===== 과제 RPC 리팩터 =====
-- 원본은 student/parent 분기만 있었고 링크가 항상 /me/assignments/{id}였다.
-- 헬퍼는 teacher/owner 분기도 갖지만, 폼·zod가 roles를 student|parent로 제한하므로 실동작 동일.
CREATE OR REPLACE FUNCTION public.create_assignment_notifications(p_assignment_id uuid, p_roles text[])
RETURNS integer LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_academy_id uuid; v_class_id uuid; v_title text; v_created_by uuid;
BEGIN
    SELECT academy_id, class_id, title, created_by
      INTO v_academy_id, v_class_id, v_title, v_created_by
    FROM assignments WHERE id = p_assignment_id;
    IF v_academy_id IS NULL THEN RAISE EXCEPTION '과제를 찾을 수 없습니다.'; END IF;
    IF NOT (v_created_by = auth.uid() OR EXISTS (
        SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'owner' AND u.academy_id = v_academy_id
    )) THEN RAISE EXCEPTION '권한이 없습니다.'; END IF;

    RETURN app_fanout_scope_notifications(
        v_academy_id, v_class_id, p_roles, 'assignment', '새 과제: ' || v_title,
        p_assignment_id, v_created_by,
        '/owner/assignments/' || p_assignment_id::text,
        '/teacher/assignments/' || p_assignment_id::text,
        '/me/assignments/' || p_assignment_id::text);
END; $$;
