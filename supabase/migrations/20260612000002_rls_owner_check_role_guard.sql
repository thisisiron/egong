-- 보안 수정: owner 전용 FOR ALL 정책의 WITH CHECK에 role 가드 추가.
--
-- 문제: 아래 8개 정책은 USING에는 current_user_role() = 'owner' 가드가 있으나
-- WITH CHECK에는 academy 일치만 검사하고 role 검사가 빠져 있었다. RLS 정책은
-- permissive(OR)이고 INSERT에는 WITH CHECK만 적용되므로, 같은 학원 academy를 가진
-- teacher/student/parent 계정이 owner 정책의 WITH CHECK를 통과해 해당 테이블에
-- INSERT할 수 있었다(권한 상승). 예) 학부모가 임의 학생에 student_parent 링크를
-- 만들어 그 학생 데이터 열람, 학생이 본인을 임의 반에 등록/출결 생성, 학생이
-- teachers row를 위조해 교사 멤버십 획득 등.
--
-- 실측(REST + in-tx 시뮬레이션)으로 8개 테이블 모두 비인가 INSERT가 통과함을 확인.
-- (students/classes/class_teachers는 PostgREST return=representation의 RETURNING
--  SELECT 단계에서 가려졌을 뿐, return=minimal로 보면 실제로 행이 생성됨.)
--
-- 수정: WITH CHECK를 동일 정책의 USING과 같게 만들어 owner role 가드를 추가한다.
-- (선례: student_notes_owner_all=커밋 75db0cb, announcements_owner_all는 처음부터 가드 보유)
-- USING은 변경하지 않는다. 멱등(ALTER POLICY).

-- ---------- 직접 academy_id 컬럼 ----------
ALTER POLICY teachers_owner_all ON public.teachers
  WITH CHECK (current_user_role() = 'owner' AND academy_id = current_user_academy());

ALTER POLICY students_owner_all ON public.students
  WITH CHECK (current_user_role() = 'owner' AND academy_id = current_user_academy());

ALTER POLICY classes_owner_all ON public.classes
  WITH CHECK (current_user_role() = 'owner' AND academy_id = current_user_academy());

-- ---------- app_* SECURITY DEFINER 헬퍼 경유 ----------
ALTER POLICY ct_owner_all ON public.class_teachers
  WITH CHECK (current_user_role() = 'owner' AND app_class_academy(class_id) = current_user_academy());

ALTER POLICY cs_owner_all ON public.class_students
  WITH CHECK (current_user_role() = 'owner' AND app_class_academy(class_id) = current_user_academy());

ALTER POLICY sp_owner_all ON public.student_parent
  WITH CHECK (current_user_role() = 'owner' AND app_student_academy(student_id) = current_user_academy());

ALTER POLICY sessions_owner_all ON public.sessions
  WITH CHECK (current_user_role() = 'owner' AND app_class_academy(class_id) = current_user_academy());

ALTER POLICY att_owner_all ON public.attendance
  WITH CHECK (current_user_role() = 'owner' AND app_session_academy(session_id) = current_user_academy());
