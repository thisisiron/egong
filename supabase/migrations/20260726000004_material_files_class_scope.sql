-- 자료(materials) storage 경로에 반(class) 스코프 반영.
--
-- 문제: 기존 경로가 {academy_id}/{uuid}.{ext}라 학원 내 반 구분이 없다. materials 행(row) RLS는
-- 반별로 올바르게 숨기지만, storage.objects의 mfiles_member_read는 academy_id만 검사하므로
-- 학생·학부모가 supabase.storage.from('material-files').list(academyId)로 같은 학원의
-- 모든 반(자신이 속하지 않은 반 포함) 자료 파일을 열람·서명 가능했다(크로스 클래스 유출).
--
-- 해법: 경로를 {academy_id}/{class_id | 'all'}/{uuid}.{ext}로 바꾸고, mfiles_member_read가
-- [2](class 세그먼트)까지 검사하도록 재작성한다. 'all'은 학원 전체 자료(class_id IS NULL).
--
-- 주의: 'all'은 uuid로 캐스팅 불가 — 헬퍼가 반환하는 uuid를 text로 캐스팅해 비교한다.
-- app_my_enrolled_class_ids() / app_my_child_class_ids()는 setof uuid (20260531000001 참고).
--
-- 데이터 마이그레이션 불필요: materials 0행, storage.objects(material-files) 0건 확인 후 적용.
-- 멱등: DROP POLICY IF EXISTS + CREATE POLICY.

DROP POLICY IF EXISTS mfiles_member_read ON storage.objects;

CREATE POLICY mfiles_member_read ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'material-files'
        AND (storage.foldername(name))[1] = current_user_academy()::text
        AND (
            (storage.foldername(name))[2] = 'all'
            OR (current_user_role() = 'student'
                AND (storage.foldername(name))[2] IN (SELECT c::text FROM app_my_enrolled_class_ids() c))
            OR (current_user_role() = 'parent'
                AND (storage.foldername(name))[2] IN (SELECT c::text FROM app_my_child_class_ids() c))
        ));
