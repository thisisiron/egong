-- 과제 정책을 teacher=owner parity(20260613000005)에 정렬.
-- 005가 기존 *_owner_all만 확장했으므로, 004에서 새로 만든 과제 정책을 동일하게 확장한다.
-- 협소 teacher 정책(assignments_teacher_*, asub_teacher_*)은 owner_all과 OR 결합돼 dead가 되지만,
-- 005 선례대로 제거는 별도 정리로 남긴다.

ALTER POLICY assignments_owner_all ON public.assignments
  USING (current_user_role() IN ('owner','teacher') AND academy_id = current_user_academy())
  WITH CHECK (current_user_role() IN ('owner','teacher') AND academy_id = current_user_academy());

ALTER POLICY asub_owner_all ON public.assignment_submissions
  USING (current_user_role() IN ('owner','teacher') AND academy_id = current_user_academy())
  WITH CHECK (current_user_role() IN ('owner','teacher') AND academy_id = current_user_academy());
