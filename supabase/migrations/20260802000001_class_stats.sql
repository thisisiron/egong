-- 반별 운영 지표(통계 대시보드) — 월 단위 출석률·과제 제출률 + 전월 대비.
-- DDD: 출결·과제 두 도메인을 가로지르는 읽기 전용 뷰. 새 테이블 없음.
--
-- 이 RPC가 존재하는 이유:
--   1. 권한 판정을 한 곳에 모은다 (owner=학원 전체, teacher=담당 반).
--   2. 두 달치를 한 번 스캔해 이번 달·전월을 함께 돌려준다 (프론트 N+1 회피).
--   3. 분모 정의(명단 기준·마감 기준)를 SQL 한 파일에 모아둔다.
--
-- 멱등: CREATE OR REPLACE.

CREATE OR REPLACE FUNCTION public.class_stats_for_month(p_month date)
RETURNS TABLE (
    class_id            uuid,
    class_name          text,
    student_count       int,
    attendance_pct      numeric,
    attendance_pct_prev numeric,
    submission_pct      numeric,
    submission_pct_prev numeric
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_this_start  date;
    v_prev_start  date;
    v_range_end   date;
    v_as_of       date;
    v_late_weight numeric;
    v_role        text;
    v_academy     uuid;
BEGIN
    -- ===== 권한 =====
    -- COALESCE 필수: users row가 없는 호출자는 current_user_role()이 NULL이라
    -- 식 전체가 NULL이 되는데, plpgsql의 IF NOT NULL은 가드를 통과시킨다.
    v_role := current_user_role();
    IF NOT COALESCE(v_role IN ('owner', 'teacher'), false) THEN
        RETURN;  -- 비인가는 에러가 아니라 빈 결과 (반 존재 여부도 누설하지 않는다)
    END IF;
    v_academy := current_user_academy();
    IF v_academy IS NULL THEN
        RETURN;
    END IF;

    -- ===== 기간 =====
    -- 프론트가 월 중간 날짜를 넘겨도 같은 결과가 나오도록 정규화한다.
    v_this_start := date_trunc('month', p_month)::date;
    v_prev_start := (v_this_start - interval '1 month')::date;
    v_range_end  := (v_this_start + interval '1 month' - interval '1 day')::date;
    -- 학생 수 기준일: 선택 월 말일과 오늘 중 이른 쪽.
    -- 8월을 보면서 현재 인원이 보이면 다른 숫자들과 시점이 어긋난다.
    v_as_of := LEAST(v_range_end, CURRENT_DATE);

    SELECT COALESCE((a.settings->>'late_weight')::numeric, 0.4)
      INTO v_late_weight
      FROM academy a WHERE a.id = v_academy;
    v_late_weight := COALESCE(v_late_weight, 0.4);

    RETURN QUERY
    WITH scope AS (
        SELECT c.id, c.name
        FROM classes c
        WHERE c.academy_id = v_academy
          AND (
            v_role = 'owner'
            OR c.id IN (SELECT app_my_taught_class_ids())
          )
    ),
    -- 출석률: attendance_rate()와 같은 가중 공식.
    -- 모집단은 "입력된 출결 행"이다 — 출결 미입력 세션은 분모에서 빠진다.
    att AS (
        SELECT
            s.class_id AS cid,
            date_trunc('month', (s.scheduled_at AT TIME ZONE 'Asia/Seoul')::date)::date AS bucket,
            ROUND(
                SUM(CASE att.status
                        WHEN 'present' THEN 1.0
                        WHEN 'late' THEN (1.0 - v_late_weight)
                        ELSE 0.0
                    END) / COUNT(*) * 100
            , 1) AS pct
        FROM attendance att
        JOIN sessions s ON s.id = att.session_id
        WHERE s.class_id IN (SELECT id FROM scope)
          AND s.cancelled = false
          AND (s.scheduled_at AT TIME ZONE 'Asia/Seoul')::date
              BETWEEN v_prev_start AND v_range_end
        GROUP BY 1, 2
    ),
    -- 과제 분모: 마감일 시점의 반 명단. due_at이 NULL인 과제는 제외한다
    -- (기한이 없으면 제출률이 정의되지 않는다).
    asg_base AS (
        SELECT
            a.id AS assignment_id,
            a.class_id AS cid,
            date_trunc('month', (a.due_at AT TIME ZONE 'Asia/Seoul')::date)::date AS bucket,
            (a.due_at AT TIME ZONE 'Asia/Seoul')::date AS due_date
        FROM assignments a
        WHERE a.class_id IN (SELECT id FROM scope)
          AND a.due_at IS NOT NULL
          AND (a.due_at AT TIME ZONE 'Asia/Seoul')::date
              BETWEEN v_prev_start AND v_range_end
    ),
    asg_roster AS (
        SELECT b.assignment_id, b.cid, b.bucket, cs.student_id
        FROM asg_base b
        JOIN class_students cs
          ON cs.class_id = b.cid
         AND cs.joined_at <= b.due_date
         AND (cs.left_at IS NULL OR cs.left_at >= b.due_date)
    ),
    asg AS (
        SELECT
            r.cid,
            r.bucket,
            ROUND(
                COUNT(*) FILTER (
                    WHERE EXISTS (
                        SELECT 1 FROM assignment_submissions sub
                        WHERE sub.assignment_id = r.assignment_id
                          AND sub.student_id = r.student_id
                    )
                )::numeric / COUNT(*) * 100
            , 1) AS pct
        FROM asg_roster r
        GROUP BY 1, 2
    ),
    cnt AS (
        SELECT cs.class_id AS cid, COUNT(*)::int AS n
        FROM class_students cs
        WHERE cs.class_id IN (SELECT id FROM scope)
          AND cs.joined_at <= v_as_of
          AND (cs.left_at IS NULL OR cs.left_at >= v_as_of)
        GROUP BY 1
    )
    SELECT
        sc.id,
        sc.name,
        COALESCE(cnt.n, 0),
        att_now.pct,
        att_prev.pct,
        asg_now.pct,
        asg_prev.pct
    FROM scope sc
    LEFT JOIN cnt ON cnt.cid = sc.id
    LEFT JOIN att att_now  ON att_now.cid  = sc.id AND att_now.bucket  = v_this_start
    LEFT JOIN att att_prev ON att_prev.cid = sc.id AND att_prev.bucket = v_prev_start
    LEFT JOIN asg asg_now  ON asg_now.cid  = sc.id AND asg_now.bucket  = v_this_start
    LEFT JOIN asg asg_prev ON asg_prev.cid = sc.id AND asg_prev.bucket = v_prev_start
    ORDER BY sc.name;
END;
$$;

-- RLS 술어 헬퍼 grant 누락으로 정책 평가가 어긋난 전례(042a7c9)가 있어 명시적으로 넣는다.
-- PUBLIC뿐 아니라 anon도 명시적으로 REVOKE한다: 이 스키마는 새 함수에 대한 기본
-- 권한(default privileges)이 anon에 직접 EXECUTE를 부여하므로(PUBLIC 경유가 아님),
-- "FROM PUBLIC"만으로는 anon의 실행 권한이 남는다. exam_report_for_student와 동일한
-- 패턴(REVOKE ... FROM PUBLIC, anon)을 따른다.
REVOKE EXECUTE ON FUNCTION public.class_stats_for_month(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.class_stats_for_month(date) TO authenticated;
