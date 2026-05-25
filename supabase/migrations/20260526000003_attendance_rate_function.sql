-- 학생의 기간별 출석률 (가중치 적용)
-- present = 1.0, late = (1 - late_weight), absent/excused = 0
-- 분모 = 회차 수 (입력된 attendance 행 기준)
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
      AND s.scheduled_at::date BETWEEN p_from AND p_to;

    IF v_total = 0 THEN
        RETURN NULL;  -- 데이터 없으면 NULL
    END IF;

    RETURN ROUND(v_score / v_total * 100, 1);
END;
$$;

-- 학생의 상태별 카운트 (UI에 11·1·0 같은 표시용)
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
      AND s.scheduled_at::date BETWEEN p_from AND p_to;
$$;
