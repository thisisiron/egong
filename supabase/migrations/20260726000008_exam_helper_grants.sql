-- 성적 — RLS 술어 헬퍼 3개의 잘못된 REVOKE 교정
--
-- 버그: 20260726000005_exams.sql이 app_exam_academy·app_exam_is_published·
--   app_my_scored_exam_ids를 "REVOKE EXECUTE ... FROM PUBLIC, anon, authenticated"로
--   회수했다. 그런데 이 셋은 같은 파일의 RLS 정책 USING/WITH CHECK 절
--   (exams_student_read·exams_parent_read·exam_scores_staff_all·
--   exam_scores_student_read·exam_scores_parent_read)에서 직접 호출된다.
--
--   RLS 정책 표현식은 SECURITY DEFINER로 실행되지 않는다 — "조회하는 사용자"의 권한으로
--   평가된다. authenticated에게서 EXECUTE를 뺏으면 그 역할로 exams/exam_scores를
--   SELECT하는 모든 쿼리가 "permission denied for function ..."로 실패한다. 즉
--   Task 1~8 전체 기능이 배포 DB에서 죽는다 — e2e가 정확히 이 에러로 이를 잡아냈다.
--
-- 왜 착각했나: "REVOKE FROM PUBLIC, anon, authenticated"는 부작용이 있거나(쓰기·알림
--   발송) 권한 상승이 가능한 헬퍼를 위한 패턴이다(예: app_fanout_scope_notifications —
--   임의 사용자에게 알림을 꽂을 수 있어 인증된 호출자가 직접 호출하면 안 된다).
--   RLS 술어 헬퍼는 정반대다: "조회하는 역할이 실행 가능해야" RLS 자체가 작동한다.
--   이 코드베이스의 원형인 20260531000001_rls_recursion_fix.sql의
--   app_class_academy·app_my_enrolled_class_ids·app_my_student_ids 등은 정확히
--   이 이유로 REVOKE를 전혀 하지 않고 Supabase 기본 authenticated 권한을 유지한다.
--
-- 규칙(다음 사람에게): "이 헬퍼가 RLS 정책 안에서 호출되는가?"라면 authenticated는
--   반드시 유지한다. "부작용이 있거나 호출자 신원과 무관하게 데이터를 노출/변경할 수
--   있는가?"라면(예: 알림 팬아웃, exam_report_for_student 내부 전용 판정 헬퍼
--   app_can_view_student_scores) authenticated에서 회수한다. 트리거 함수
--   (exam_scores_check_max·exam_scores_check_roster)는 세 번째 범주 — Postgres가
--   EXECUTE 권한을 트리거 발동(fire) 시점이 아니라 CREATE TRIGGER 시점에 소유자 권한으로
--   확인하므로 revoke돼 있어도 정상 작동한다(20260726000005·000007에서 이미 확인).
--   이 헬퍼 3개를 "다시 굳힌다"며 authenticated를 재차 회수하지 말 것.

GRANT EXECUTE ON FUNCTION public.app_exam_academy(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_exam_is_published(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_my_scored_exam_ids() TO authenticated;

-- anon·PUBLIC은 계속 회수 상태로 — 종단 상태를 이 파일에서 명시적으로 재선언한다.
REVOKE EXECUTE ON FUNCTION public.app_exam_academy(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.app_exam_is_published(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.app_my_scored_exam_ids() FROM PUBLIC, anon;
