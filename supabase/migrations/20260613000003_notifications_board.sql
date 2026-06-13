-- 인앱 알림 인프라 + 공지 게시판 type 컬럼
--
-- notifications: 수신자당 1행(fan-out). type별로 공지/출결/과제 등을 한 테이블에 수용.
--   본인 알림만 SELECT/UPDATE(읽음). INSERT는 클라 금지 — definer RPC로만 생성.
-- create_announcement_notifications: teacher가 학부모/학생 user_id를 RLS상 못 읽으므로
--   SECURITY DEFINER로 수신자(역할 그룹 ∩ 공지 범위)를 해석해 일괄 insert.
--   가드: 호출자가 공지 작성자 본인이거나 그 학원 owner일 때만 (PostgREST /rpc 직접 호출 방어).
-- announcements.type: 게시판 글 종류 확장 hook. 1차엔 'announcement'만 사용.

ALTER TABLE announcements ADD COLUMN type text NOT NULL DEFAULT 'announcement';

CREATE TABLE notifications (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    academy_id  uuid NOT NULL REFERENCES academy(id) ON DELETE CASCADE,
    type        text NOT NULL,
    title       text NOT NULL,
    link        text NOT NULL,
    source_id   uuid,
    read_at     timestamptz,
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user ON notifications(user_id, created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY notifications_admin_all ON notifications FOR ALL TO authenticated
    USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY notifications_self_read ON notifications FOR SELECT TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY notifications_self_update ON notifications FOR UPDATE TO authenticated
    USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- INSERT 정책 없음 → authenticated 클라 직접 insert 불가. 아래 RPC(definer)로만 생성.

CREATE OR REPLACE FUNCTION public.create_announcement_notifications(
    p_announcement_id uuid,
    p_roles text[]
) RETURNS integer
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_academy_id uuid;
    v_class_id uuid;
    v_title text;
    v_created_by uuid;
    v_count int;
BEGIN
    SELECT academy_id, class_id, title, created_by
    INTO v_academy_id, v_class_id, v_title, v_created_by
    FROM announcements WHERE id = p_announcement_id;

    IF v_academy_id IS NULL THEN
        RAISE EXCEPTION '공지를 찾을 수 없습니다.';
    END IF;

    -- 가드: 작성자 본인 또는 그 학원 owner만
    IF NOT (
        v_created_by = auth.uid()
        OR EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = auth.uid() AND u.role = 'owner' AND u.academy_id = v_academy_id
        )
    ) THEN
        RAISE EXCEPTION '권한이 없습니다.';
    END IF;

    WITH recipients AS (
        -- 학생 (user_id 있는 재원생만 — 초등은 user_id NULL일 수 있음)
        SELECT s.user_id AS uid
        FROM students s
        WHERE 'student' = ANY(p_roles)
          AND s.user_id IS NOT NULL
          AND (
            (v_class_id IS NULL AND s.academy_id = v_academy_id)
            OR s.id IN (SELECT cs.student_id FROM class_students cs
                        WHERE cs.class_id = v_class_id AND cs.left_at IS NULL)
          )
        UNION
        -- 학부모 (대상 학생들의 학부모)
        SELECT p.user_id AS uid
        FROM parents p
        JOIN student_parent sp ON sp.parent_id = p.id
        JOIN students s ON s.id = sp.student_id
        WHERE 'parent' = ANY(p_roles)
          AND (
            (v_class_id IS NULL AND s.academy_id = v_academy_id)
            OR s.id IN (SELECT cs.student_id FROM class_students cs
                        WHERE cs.class_id = v_class_id AND cs.left_at IS NULL)
          )
        UNION
        -- 선생 (반별이면 담당, 전체면 학원 전체)
        SELECT t.user_id AS uid
        FROM teachers t
        WHERE 'teacher' = ANY(p_roles)
          AND (
            (v_class_id IS NULL AND t.academy_id = v_academy_id)
            OR t.id IN (SELECT ct.teacher_id FROM class_teachers ct WHERE ct.class_id = v_class_id)
          )
        UNION
        -- 원장
        SELECT u.id AS uid
        FROM users u
        WHERE 'owner' = ANY(p_roles)
          AND u.role = 'owner'
          AND u.academy_id = v_academy_id
    )
    INSERT INTO notifications (user_id, academy_id, type, title, link, source_id)
    SELECT DISTINCT r.uid, v_academy_id, 'announcement', v_title,
        CASE u.role
            WHEN 'owner' THEN '/owner/announcements'
            WHEN 'teacher' THEN '/teacher/announcements'
            ELSE '/me/board'
        END,
        p_announcement_id
    FROM recipients r
    JOIN users u ON u.id = r.uid
    WHERE r.uid IS NOT NULL AND r.uid <> v_created_by;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_announcement_notifications(uuid, text[]) TO authenticated;
