-- RLS 무한 재귀(infinite recursion) 해소.
--
-- 문제: classes/class_teachers/class_students/students/parents/student_parent/
-- sessions/attendance 의 정책들이 서로의 테이블을 서브쿼리로 읽으면서 순환 참조가
-- 생긴다. 예) classes_teacher_read → class_teachers 읽기 → ct_owner_all → classes 읽기 → ...
-- Postgres가 "infinite recursion detected in policy for relation ..." 에러를 던진다.
--
-- 해법: 멤버십(소속) 조회를 SECURITY DEFINER 함수로 분리한다. SECURITY DEFINER 함수
-- 내부 쿼리는 함수 소유자(postgres) 권한으로 실행되어 RLS를 우회하므로, 정책 평가 중
-- 다른 테이블의 RLS를 다시 트리거하지 않는다 → 순환 차단.
--
-- 권한(authorization) 의미는 기존과 100% 동일하게 유지한다. 정책 USING/CHECK 식에서
-- 인라인 서브쿼리를 동일 의미의 함수 호출로만 치환한다.
--
-- 멱등: 함수는 CREATE OR REPLACE, 정책은 DROP IF EXISTS + CREATE.

-- =====================================================================
-- 1. SECURITY DEFINER 멤버십 helper 함수들
-- =====================================================================

-- 학급 → 소속 학원
CREATE OR REPLACE FUNCTION public.app_class_academy(p_class_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT academy_id FROM classes WHERE id = p_class_id
$$;

-- 세션 → 소속 학원 (세션의 반의 학원)
CREATE OR REPLACE FUNCTION public.app_session_academy(p_session_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.academy_id
  FROM sessions s JOIN classes c ON c.id = s.class_id
  WHERE s.id = p_session_id
$$;

-- 학생 → 소속 학원
CREATE OR REPLACE FUNCTION public.app_student_academy(p_student_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT academy_id FROM students WHERE id = p_student_id
$$;

-- 현재 사용자(teacher)가 가르치는 class_id 집합
CREATE OR REPLACE FUNCTION public.app_my_taught_class_ids()
RETURNS setof uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT ct.class_id
  FROM class_teachers ct JOIN teachers t ON t.id = ct.teacher_id
  WHERE t.user_id = auth.uid()
$$;

-- 현재 사용자(student)가 현재 배정된 class_id 집합
CREATE OR REPLACE FUNCTION public.app_my_enrolled_class_ids()
RETURNS setof uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT cs.class_id
  FROM class_students cs JOIN students s ON s.id = cs.student_id
  WHERE s.user_id = auth.uid() AND cs.left_at IS NULL
$$;

-- 현재 사용자(parent)의 자녀가 배정된 class_id 집합
CREATE OR REPLACE FUNCTION public.app_my_child_class_ids()
RETURNS setof uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT cs.class_id
  FROM class_students cs
  JOIN student_parent sp ON sp.student_id = cs.student_id
  JOIN parents p ON p.id = sp.parent_id
  WHERE p.user_id = auth.uid() AND cs.left_at IS NULL
$$;

-- 현재 사용자(student) 자신의 student_id 집합
CREATE OR REPLACE FUNCTION public.app_my_student_ids()
RETURNS setof uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM students WHERE user_id = auth.uid()
$$;

-- 현재 사용자(parent)의 자녀 student_id 집합
CREATE OR REPLACE FUNCTION public.app_my_child_student_ids()
RETURNS setof uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT sp.student_id
  FROM student_parent sp JOIN parents p ON p.id = sp.parent_id
  WHERE p.user_id = auth.uid()
$$;

-- 현재 사용자(teacher)가 가르치는 학생 student_id 집합
CREATE OR REPLACE FUNCTION public.app_my_taught_student_ids()
RETURNS setof uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT cs.student_id
  FROM class_students cs
  JOIN class_teachers ct ON ct.class_id = cs.class_id
  JOIN teachers t ON t.id = ct.teacher_id
  WHERE t.user_id = auth.uid() AND cs.left_at IS NULL
$$;

-- 현재 사용자(teacher)가 가르치는 반의 session_id 집합
CREATE OR REPLACE FUNCTION public.app_my_taught_session_ids()
RETURNS setof uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.id
  FROM sessions s
  JOIN class_teachers ct ON ct.class_id = s.class_id
  JOIN teachers t ON t.id = ct.teacher_id
  WHERE t.user_id = auth.uid()
$$;

-- 현재 사용자(parent) 자신의 parent_id 집합
CREATE OR REPLACE FUNCTION public.app_my_parent_ids()
RETURNS setof uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM parents WHERE user_id = auth.uid()
$$;

-- 현재 owner의 학원에 속한 parent_id 집합 (자녀가 그 학원 학생인 학부모)
CREATE OR REPLACE FUNCTION public.app_academy_parent_ids(p_academy_id uuid)
RETURNS setof uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT sp.parent_id
  FROM student_parent sp JOIN students s ON s.id = sp.student_id
  WHERE s.academy_id = p_academy_id
$$;

-- 현재 owner의 학원에 속한 parent role user_id 집합
CREATE OR REPLACE FUNCTION public.app_academy_parent_user_ids(p_academy_id uuid)
RETURNS setof uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM users WHERE academy_id = p_academy_id AND role = 'parent'
$$;

-- =====================================================================
-- 2. 정책 재작성 (인라인 서브쿼리 → 함수 호출)
-- =====================================================================

-- ---------- classes ----------
DROP POLICY IF EXISTS classes_teacher_read ON public.classes;
CREATE POLICY classes_teacher_read ON public.classes FOR SELECT TO authenticated
  USING (id IN (SELECT app_my_taught_class_ids()));

DROP POLICY IF EXISTS classes_student_read ON public.classes;
CREATE POLICY classes_student_read ON public.classes FOR SELECT TO authenticated
  USING (id IN (SELECT app_my_enrolled_class_ids()));

DROP POLICY IF EXISTS classes_parent_read ON public.classes;
CREATE POLICY classes_parent_read ON public.classes FOR SELECT TO authenticated
  USING (id IN (SELECT app_my_child_class_ids()));

-- ---------- class_teachers ----------
DROP POLICY IF EXISTS ct_owner_all ON public.class_teachers;
CREATE POLICY ct_owner_all ON public.class_teachers FOR ALL TO authenticated
  USING (current_user_role() = 'owner' AND app_class_academy(class_id) = current_user_academy())
  WITH CHECK (app_class_academy(class_id) = current_user_academy());

DROP POLICY IF EXISTS ct_teacher_read ON public.class_teachers;
CREATE POLICY ct_teacher_read ON public.class_teachers FOR SELECT TO authenticated
  USING (class_id IN (SELECT app_my_taught_class_ids()));

-- ---------- class_students ----------
DROP POLICY IF EXISTS cs_owner_all ON public.class_students;
CREATE POLICY cs_owner_all ON public.class_students FOR ALL TO authenticated
  USING (current_user_role() = 'owner' AND app_class_academy(class_id) = current_user_academy())
  WITH CHECK (app_class_academy(class_id) = current_user_academy());

DROP POLICY IF EXISTS cs_teacher_read ON public.class_students;
CREATE POLICY cs_teacher_read ON public.class_students FOR SELECT TO authenticated
  USING (class_id IN (SELECT app_my_taught_class_ids()));

DROP POLICY IF EXISTS cs_self_read ON public.class_students;
CREATE POLICY cs_self_read ON public.class_students FOR SELECT TO authenticated
  USING (student_id IN (SELECT app_my_student_ids()));

DROP POLICY IF EXISTS cs_parent_read ON public.class_students;
CREATE POLICY cs_parent_read ON public.class_students FOR SELECT TO authenticated
  USING (student_id IN (SELECT app_my_child_student_ids()));

-- ---------- students ----------
DROP POLICY IF EXISTS students_teacher_read ON public.students;
CREATE POLICY students_teacher_read ON public.students FOR SELECT TO authenticated
  USING (current_user_role() = 'teacher' AND id IN (SELECT app_my_taught_student_ids()));

DROP POLICY IF EXISTS students_parent_read ON public.students;
CREATE POLICY students_parent_read ON public.students FOR SELECT TO authenticated
  USING (id IN (SELECT app_my_child_student_ids()));

-- ---------- parents ----------
DROP POLICY IF EXISTS parents_owner_select ON public.parents;
CREATE POLICY parents_owner_select ON public.parents FOR SELECT TO authenticated
  USING (
    current_user_role() = 'owner' AND (
      id IN (SELECT app_academy_parent_ids(current_user_academy()))
      OR user_id IN (SELECT app_academy_parent_user_ids(current_user_academy()))
    )
  );

DROP POLICY IF EXISTS parents_owner_update ON public.parents;
CREATE POLICY parents_owner_update ON public.parents FOR UPDATE TO authenticated
  USING (
    current_user_role() = 'owner' AND (
      id IN (SELECT app_academy_parent_ids(current_user_academy()))
      OR user_id IN (SELECT app_academy_parent_user_ids(current_user_academy()))
    )
  )
  WITH CHECK (current_user_role() = 'owner');

DROP POLICY IF EXISTS parents_owner_delete ON public.parents;
CREATE POLICY parents_owner_delete ON public.parents FOR DELETE TO authenticated
  USING (
    current_user_role() = 'owner' AND (
      id IN (SELECT app_academy_parent_ids(current_user_academy()))
      OR user_id IN (SELECT app_academy_parent_user_ids(current_user_academy()))
    )
  );

-- ---------- student_parent ----------
DROP POLICY IF EXISTS sp_owner_all ON public.student_parent;
CREATE POLICY sp_owner_all ON public.student_parent FOR ALL TO authenticated
  USING (
    current_user_role() = 'owner'
    AND app_student_academy(student_id) = current_user_academy()
  )
  WITH CHECK (app_student_academy(student_id) = current_user_academy());

DROP POLICY IF EXISTS sp_parent_read ON public.student_parent;
CREATE POLICY sp_parent_read ON public.student_parent FOR SELECT TO authenticated
  USING (parent_id IN (SELECT app_my_parent_ids()));

-- ---------- sessions ----------
DROP POLICY IF EXISTS sessions_owner_all ON public.sessions;
CREATE POLICY sessions_owner_all ON public.sessions FOR ALL TO authenticated
  USING (current_user_role() = 'owner' AND app_class_academy(class_id) = current_user_academy())
  WITH CHECK (app_class_academy(class_id) = current_user_academy());

DROP POLICY IF EXISTS sessions_teacher_all ON public.sessions;
CREATE POLICY sessions_teacher_all ON public.sessions FOR ALL TO authenticated
  USING (current_user_role() = 'teacher' AND class_id IN (SELECT app_my_taught_class_ids()))
  WITH CHECK (class_id IN (SELECT app_my_taught_class_ids()));

DROP POLICY IF EXISTS sessions_student_read ON public.sessions;
CREATE POLICY sessions_student_read ON public.sessions FOR SELECT TO authenticated
  USING (class_id IN (SELECT app_my_enrolled_class_ids()));

DROP POLICY IF EXISTS sessions_parent_read ON public.sessions;
CREATE POLICY sessions_parent_read ON public.sessions FOR SELECT TO authenticated
  USING (class_id IN (SELECT app_my_child_class_ids()));

-- ---------- attendance ----------
DROP POLICY IF EXISTS att_owner_all ON public.attendance;
CREATE POLICY att_owner_all ON public.attendance FOR ALL TO authenticated
  USING (current_user_role() = 'owner' AND app_session_academy(session_id) = current_user_academy())
  WITH CHECK (app_session_academy(session_id) = current_user_academy());

DROP POLICY IF EXISTS att_teacher_all ON public.attendance;
CREATE POLICY att_teacher_all ON public.attendance FOR ALL TO authenticated
  USING (current_user_role() = 'teacher' AND session_id IN (SELECT app_my_taught_session_ids()))
  WITH CHECK (session_id IN (SELECT app_my_taught_session_ids()));

DROP POLICY IF EXISTS att_student_read ON public.attendance;
CREATE POLICY att_student_read ON public.attendance FOR SELECT TO authenticated
  USING (student_id IN (SELECT app_my_student_ids()));

DROP POLICY IF EXISTS att_parent_read ON public.attendance;
CREATE POLICY att_parent_read ON public.attendance FOR SELECT TO authenticated
  USING (student_id IN (SELECT app_my_child_student_ids()));
