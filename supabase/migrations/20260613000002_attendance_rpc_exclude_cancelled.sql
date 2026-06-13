-- 월 출결 집계 휴강 제외: attendance_rate / attendance_counts RPC가 휴강(cancelled=true)
-- 세션의 출결 행을 모집단에서 빼도록 WHERE에 s.cancelled = false 추가.
-- (출결 입력 후 사후 휴강 처리한 세션의 잔여 출결 행이 월 출석률을 왜곡하던 문제.)
-- 20260612000004의 함수 본문을 그대로 두고 cancelled 가드만 추가. 멱등(CREATE OR REPLACE).

CREATE OR REPLACE FUNCTION attendance_rate(
    p_student_id uuid,
    p_from date,
    p_to date
) RETURNS numeric
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_late_weight numeric;
    v_total int;
    v_score numeric;
BEGIN
    IF NOT app_can_view_student_attendance(p_student_id) THEN
        RETURN NULL;
    END IF;

    SELECT (a.settings->>'late_weight')::numeric
    INTO v_late_weight
    FROM students s
    JOIN academy a ON a.id = s.academy_id
    WHERE s.id = p_student_id;

    IF v_late_weight IS NULL THEN
        v_late_weight := 0.4;
    END IF;

    SELECT
        count(*) FILTER (WHERE att.status IN ('present', 'late', 'absent', 'excused')),
        COALESCE(SUM(
            CASE att.status
                WHEN 'present' THEN 1.0
                WHEN 'late' THEN (1.0 - v_late_weight)
                ELSE 0.0
            END
        ), 0)
    INTO v_total, v_score
    FROM attendance att
    JOIN sessions s ON s.id = att.session_id
    WHERE att.student_id = p_student_id
      AND s.cancelled = false
      AND (s.scheduled_at AT TIME ZONE 'Asia/Seoul')::date BETWEEN p_from AND p_to;

    IF v_total = 0 THEN
        RETURN NULL;
    END IF;

    RETURN ROUND(v_score / v_total * 100, 1);
END;
$$;

CREATE OR REPLACE FUNCTION attendance_counts(
    p_student_id uuid,
    p_from date,
    p_to date
) RETURNS TABLE (
    present_count int,
    late_count int,
    absent_count int,
    excused_count int
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT
        count(*) FILTER (WHERE att.status = 'present')::int,
        count(*) FILTER (WHERE att.status = 'late')::int,
        count(*) FILTER (WHERE att.status = 'absent')::int,
        count(*) FILTER (WHERE att.status = 'excused')::int
    FROM attendance att
    JOIN sessions s ON s.id = att.session_id
    WHERE att.student_id = p_student_id
      AND s.cancelled = false
      AND (s.scheduled_at AT TIME ZONE 'Asia/Seoul')::date BETWEEN p_from AND p_to
      AND app_can_view_student_attendance(p_student_id);
$$;
