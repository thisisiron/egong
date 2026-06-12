-- 보안 수정: attendance_rate / attendance_counts RPC에 호출자 권한 검사 추가.
--
-- 문제: 두 함수는 SECURITY DEFINER로 RLS를 우회하는데 호출자 검사가 전혀 없어,
-- PostgREST /rpc/ 경로로 임의의 authenticated 사용자(타 학원 학부모/학생 포함)가
-- 아무 학생 UUID로 호출해 출석률·출결 카운트를 조회할 수 있었다.
--
-- 수정: 호출자가 그 학생의 출결을 볼 수 있는지 검사하는 helper를 추가하고,
-- 두 함수 시작부에서 가드한다. 허용 범위는 기존 RLS 정책과 동일:
--   admin │ owner(같은 학원) │ teacher(가르치는 학생) │ 본인 │ 자녀(학부모)
-- 비인가 호출은 데이터 없음과 동일하게 NULL(rate) / 0(counts)을 반환해
-- 학생 존재 여부도 누설하지 않는다.
--
-- app_* SECURITY DEFINER 헬퍼는 20260531000001_rls_recursion_fix.sql 정의분 재사용.
-- 멱등(CREATE OR REPLACE).
--
-- 추가(코드리뷰 후속): 월 경계 비교를 s.scheduled_at::date(UTC 날짜)에서
-- (s.scheduled_at AT TIME ZONE 'Asia/Seoul')::date(KST 날짜)로 — 캘린더
-- (buildMonthDays, KST 버킷팅)와 통계의 월 귀속이 일치하도록. KST 새벽
-- (00:00~08:59) 세션이 통계에선 전월, 캘린더에선 당월로 갈리던 문제 해소.

-- 호출자가 p_student_id 학생의 출결을 볼 수 있는가
-- COALESCE 필수: users row가 없는 호출자는 current_user_role()이 NULL이라
-- 식 전체가 NULL이 되는데, plpgsql IF NOT NULL은 가드를 통과시킨다.
CREATE OR REPLACE FUNCTION public.app_can_view_student_attendance(p_student_id uuid)
RETURNS boolean LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT COALESCE(
    current_user_role() = 'admin'
    OR (
      current_user_role() = 'owner'
      AND app_student_academy(p_student_id) = current_user_academy()
    )
    OR (
      current_user_role() = 'teacher'
      AND p_student_id IN (SELECT app_my_taught_student_ids())
    )
    OR p_student_id IN (SELECT app_my_student_ids())
    OR p_student_id IN (SELECT app_my_child_student_ids())
  , false)
$$;

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
      AND (s.scheduled_at AT TIME ZONE 'Asia/Seoul')::date BETWEEN p_from AND p_to;

    IF v_total = 0 THEN
        RETURN NULL;  -- 데이터 없으면 NULL
    END IF;

    RETURN ROUND(v_score / v_total * 100, 1);
END;
$$;

-- 학생의 상태별 카운트 (UI에 11·1·0 같은 표시용)
-- 비인가 호출은 WHERE 가드에 걸려 전부 0 (aggregate라 행은 항상 1개 반환)
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
      AND (s.scheduled_at AT TIME ZONE 'Asia/Seoul')::date BETWEEN p_from AND p_to
      AND app_can_view_student_attendance(p_student_id);
$$;
