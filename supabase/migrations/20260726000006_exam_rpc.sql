-- 성적 RPC — 권한 가드 + 학생 리포트(집계) + 공개 알림
-- 리포트 RPC의 존재 이유: 학생은 타인 점수 행을 읽을 수 없는데(RLS) 반 평균·최고점은 봐야 한다.
--   시험당 한 행씩 돌려주므로 추이 그래프와 목록이 한 번의 호출로 채워진다(N+1 회피).
-- 스냅샷(공개 시 평균을 exams에 저장)을 쓰지 않은 이유: 공개 후 점수를 정정하면 낡는다.

-- ===== 권한 가드 =====
-- attendance의 app_can_view_student_attendance와 판정 규칙이 동일:
--   admin │ owner(같은 학원) │ teacher(가르치는 학생) │ 본인 │ 자녀(학부모)
-- COALESCE 필수: users row가 없는 호출자는 current_user_role()이 NULL이라 식 전체가
--   NULL이 되는데, plpgsql의 IF NOT NULL은 가드를 통과시킨다(20260726000002 후속 수정 참고).
CREATE OR REPLACE FUNCTION public.app_can_view_student_scores(p_student_id uuid)
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

-- ===== 학생 리포트 =====
-- 반환 규칙:
--   · 공개된 시험만 (published_at IS NOT NULL)
--   · 그 학생이 "시험일 기준"으로 그 반에 속했던 시험만 (EXISTS — class_students에 재등록
--     이력이 여러 행일 수 있어 JOIN하면 시험이 중복된다)
--   · 점수 행은 LEFT JOIN. 공개 시 미입력이 차단되므로 정상 경로에선 항상 행이 있지만,
--     학생이 소급 배정된 경우 행이 없을 수 있다. 그때도 시험은 나오고 내 점수만 비어야 한다
--     (INNER JOIN이면 시험이 통째로 사라진다)
--   · 평균·최고점·응시자 수는 실제 응시자만 (score IS NOT NULL AND is_absent = false)
--   · 비인가 호출은 빈 결과 — 학생 존재 여부도 누설하지 않는다
CREATE OR REPLACE FUNCTION public.exam_report_for_student(
    p_student_id uuid,
    p_from date,
    p_to date
) RETURNS TABLE (
    exam_id       uuid,
    title         text,
    exam_type     text,
    scope         text,
    exam_date     date,
    max_score     numeric,
    my_score      numeric,
    my_is_absent  boolean,
    class_avg_pct numeric,
    class_max_pct numeric,
    taker_count   int
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT app_can_view_student_scores(p_student_id) THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT
        e.id,
        e.title,
        e.exam_type,
        e.scope,
        e.exam_date,
        e.max_score,
        ms.score,
        COALESCE(ms.is_absent, false),
        agg.avg_pct,
        agg.max_pct,
        COALESCE(agg.takers, 0)
    FROM exams e
    LEFT JOIN exam_scores ms
           ON ms.exam_id = e.id AND ms.student_id = p_student_id
    LEFT JOIN LATERAL (
        SELECT round(avg(s.score / e.max_score * 100), 1) AS avg_pct,
               round(max(s.score / e.max_score * 100), 1) AS max_pct,
               count(*)::int                              AS takers
        FROM exam_scores s
        WHERE s.exam_id = e.id
          AND s.score IS NOT NULL
          AND s.is_absent = false
    ) agg ON true
    WHERE e.published_at IS NOT NULL
      AND e.exam_date >= p_from
      AND e.exam_date <= p_to
      AND EXISTS (
          SELECT 1 FROM class_students cs
          WHERE cs.class_id = e.class_id
            AND cs.student_id = p_student_id
            AND cs.joined_at <= e.exam_date
            AND (cs.left_at IS NULL OR cs.left_at >= e.exam_date)
      )
    ORDER BY e.exam_date;
END; $$;

-- ===== 공개 알림 =====
-- app_fanout_scope_notifications 래퍼. 대상은 학생·학부모로 한정(교집합) — 호출자가
--   p_roles에 'owner','teacher'를 넣어도 무시된다(20260726000002의 "역할 교집합" 관례).
-- 가드: 공개된 시험이어야 하고, 호출자가 그 학원 스태프여야 한다.
CREATE OR REPLACE FUNCTION public.create_exam_notifications(
    p_exam_id uuid,
    p_roles   text[]
) RETURNS integer
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_academy uuid;
    v_class   uuid;
    v_title   text;
    v_roles   text[];
BEGIN
    SELECT e.academy_id, e.class_id, e.title
    INTO v_academy, v_class, v_title
    FROM exams e
    WHERE e.id = p_exam_id AND e.published_at IS NOT NULL;

    IF v_academy IS NULL THEN
        RETURN 0;
    END IF;

    IF NOT COALESCE(
        current_user_role() = 'admin'
        OR (current_user_role() IN ('owner','teacher') AND v_academy = current_user_academy())
    , false) THEN
        RETURN 0;
    END IF;

    v_roles := ARRAY(
        SELECT r FROM unnest(p_roles) AS r WHERE r IN ('student','parent')
    );
    IF array_length(v_roles, 1) IS NULL THEN
        RETURN 0;
    END IF;

    RETURN app_fanout_scope_notifications(
        v_academy,
        v_class,
        v_roles,
        'exam',
        '성적 공개: ' || v_title,
        p_exam_id,
        auth.uid(),
        '/owner/exams/' || p_exam_id::text,
        '/teacher/exams/' || p_exam_id::text,
        '/me/exams'
    );
END; $$;

-- ===== 권한 =====
-- 내부 판정 헬퍼는 회수.
REVOKE EXECUTE ON FUNCTION public.app_can_view_student_scores(uuid) FROM PUBLIC, anon, authenticated;

-- 앱이 사용자 세션으로 직접 호출하는 두 RPC는 authenticated 유지(자체 가드 보유), anon만 회수.
REVOKE EXECUTE ON FUNCTION public.exam_report_for_student(uuid, date, date) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.exam_report_for_student(uuid, date, date) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.create_exam_notifications(uuid, text[]) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.create_exam_notifications(uuid, text[]) TO authenticated;
