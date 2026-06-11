-- 공지 RLS 강화 (코드리뷰 후속):
-- (1) class_id↔academy 일관성 — 반별 공지의 반은 반드시 공지의 academy 소속이어야 함.
--     기존엔 owner WITH CHECK가 자기 academy_id만 검사해, PostgREST 직접 호출로
--     타 학원 class_id를 가리키는 공지를 만들 수 있었음 (크로스 테넌트 콘텐츠 주입).
-- (2) parent의 학원 전체 공지를 '학부모 자신의 users.academy_id'가 아닌
--     '자녀가 다니는 학원들' 기준으로 — 학원 간 학부모 연결이 허용되는 스키마이므로
--     (parents에 academy 없음, by-email 연결이 학원 무관) current_user_academy()는 부정확.
-- 멱등 (CREATE OR REPLACE + ALTER POLICY).

-- (2) 현재 사용자(parent)의 자녀들이 소속된 academy_id 집합
CREATE OR REPLACE FUNCTION public.app_my_child_academy_ids()
RETURNS setof uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT s.academy_id
  FROM student_parent sp
  JOIN parents p ON p.id = sp.parent_id
  JOIN students s ON s.id = sp.student_id
  WHERE p.user_id = auth.uid()
$$;

-- (1) owner: 반별 공지면 그 반이 공지의 학원 소속이어야 함
ALTER POLICY announcements_owner_all ON public.announcements
  WITH CHECK (
    current_user_role() = 'owner'
    AND academy_id = current_user_academy()
    AND (class_id IS NULL OR app_class_academy(class_id) = academy_id)
  );

-- (1) teacher insert/update에도 동일 일관성 (두 학원의 teacher인 사용자 대비)
ALTER POLICY announcements_teacher_insert ON public.announcements
  WITH CHECK (
    current_user_role() = 'teacher'
    AND academy_id = current_user_academy()
    AND created_by = auth.uid()
    AND class_id IN (SELECT app_my_taught_class_ids())
    AND app_class_academy(class_id) = academy_id
  );

ALTER POLICY announcements_teacher_update ON public.announcements
  WITH CHECK (
    created_by = auth.uid()
    AND class_id IN (SELECT app_my_taught_class_ids())
    AND app_class_academy(class_id) = academy_id
  );

-- (2) parent 전체공지: 자녀 학원 기준
ALTER POLICY announcements_parent_read ON public.announcements
  USING (
    current_user_role() = 'parent'
    AND (
      (class_id IS NULL AND academy_id IN (SELECT app_my_child_academy_ids()))
      OR class_id IN (SELECT app_my_child_class_ids())
    )
  );
