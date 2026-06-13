-- teacher를 owner와 동등한 학원 전체 스태프로 승격.
-- *_owner_all 계열 정책의 role 가드를 owner → (owner|teacher)로 확장.
-- academy 일치 조건은 불변 → 타 학원 차단 유지. 지출은 범위 밖(미래 owner 전용).
--
-- 주의: 이 확장으로 기존 teacher 전용 협소 정책(student_notes_teacher_read/insert/delete,
-- sessions_teacher_all, *_teacher_read 등)은 owner_all과 OR 결합되어 사실상 무력화(dead)된다.
-- teacher = 학원 전체 스태프라는 의도된 결과이며, 협소 정책 제거는 별도 정리 작업으로 남긴다.

ALTER POLICY teachers_owner_all ON public.teachers
  USING (current_user_role() IN ('owner','teacher') AND academy_id = current_user_academy())
  WITH CHECK (current_user_role() IN ('owner','teacher') AND academy_id = current_user_academy());

ALTER POLICY students_owner_all ON public.students
  USING (current_user_role() IN ('owner','teacher') AND academy_id = current_user_academy())
  WITH CHECK (current_user_role() IN ('owner','teacher') AND academy_id = current_user_academy());

ALTER POLICY classes_owner_all ON public.classes
  USING (current_user_role() IN ('owner','teacher') AND academy_id = current_user_academy())
  WITH CHECK (current_user_role() IN ('owner','teacher') AND academy_id = current_user_academy());

ALTER POLICY ct_owner_all ON public.class_teachers
  USING (current_user_role() IN ('owner','teacher') AND app_class_academy(class_id) = current_user_academy())
  WITH CHECK (current_user_role() IN ('owner','teacher') AND app_class_academy(class_id) = current_user_academy());

ALTER POLICY cs_owner_all ON public.class_students
  USING (current_user_role() IN ('owner','teacher') AND app_class_academy(class_id) = current_user_academy())
  WITH CHECK (current_user_role() IN ('owner','teacher') AND app_class_academy(class_id) = current_user_academy());

ALTER POLICY sp_owner_all ON public.student_parent
  USING (current_user_role() IN ('owner','teacher') AND app_student_academy(student_id) = current_user_academy())
  WITH CHECK (current_user_role() IN ('owner','teacher') AND app_student_academy(student_id) = current_user_academy());

ALTER POLICY sessions_owner_all ON public.sessions
  USING (current_user_role() IN ('owner','teacher') AND app_class_academy(class_id) = current_user_academy())
  WITH CHECK (current_user_role() IN ('owner','teacher') AND app_class_academy(class_id) = current_user_academy());

ALTER POLICY att_owner_all ON public.attendance
  USING (current_user_role() IN ('owner','teacher') AND app_session_academy(session_id) = current_user_academy())
  WITH CHECK (current_user_role() IN ('owner','teacher') AND app_session_academy(session_id) = current_user_academy());

ALTER POLICY parents_owner_select ON public.parents
  USING (current_user_role() IN ('owner','teacher') AND (id IN (SELECT app_academy_parent_ids(current_user_academy())) OR user_id IN (SELECT app_academy_parent_user_ids(current_user_academy()))));

ALTER POLICY parents_owner_update ON public.parents
  USING (current_user_role() IN ('owner','teacher') AND (id IN (SELECT app_academy_parent_ids(current_user_academy())) OR user_id IN (SELECT app_academy_parent_user_ids(current_user_academy()))))
  WITH CHECK (current_user_role() IN ('owner','teacher'));

ALTER POLICY parents_owner_delete ON public.parents
  USING (current_user_role() IN ('owner','teacher') AND (id IN (SELECT app_academy_parent_ids(current_user_academy())) OR user_id IN (SELECT app_academy_parent_user_ids(current_user_academy()))));

-- Step 2에서 추가 발견된 정책들

-- parents_owner_insert: INSERT는 WITH CHECK만 존재 (USING 없음)
ALTER POLICY parents_owner_insert ON public.parents
  WITH CHECK (current_user_role() IN ('owner','teacher'));

-- student_notes_owner_all: USING + WITH CHECK 모두 broadened
ALTER POLICY student_notes_owner_all ON public.student_notes
  USING (current_user_role() IN ('owner','teacher') AND app_student_academy(student_id) = current_user_academy())
  WITH CHECK (current_user_role() IN ('owner','teacher') AND app_student_academy(student_id) = current_user_academy());
