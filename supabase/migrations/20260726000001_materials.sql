-- 학습지·자료(materials) + 제출물 storage
-- DDD: 독립 도메인. 스코프 모델은 공지와 동일(class_id NULL = 학원 전체).
-- RLS: 기존 app_* 헬퍼만 사용(신규 0). teacher=owner parity 반영.
-- files jsonb([{path,name}]): 경로가 {academy}/{uuid}.{ext}라 원본 파일명이 사라지는데,
--   학습지는 파일명이 곧 내용이라 보존 필수. (과제·질문의 file_paths text[]와 의도적으로 다름)

CREATE TABLE materials (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    academy_id  uuid NOT NULL REFERENCES academy(id) ON DELETE CASCADE,
    class_id    uuid REFERENCES classes(id) ON DELETE CASCADE,   -- NULL = 학원 전체
    title       text NOT NULL,
    description text,
    files       jsonb NOT NULL DEFAULT '[]'::jsonb,
    created_by  uuid REFERENCES users(id) ON DELETE SET NULL,
    author_name text NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_materials_academy ON materials(academy_id);
CREATE INDEX idx_materials_class ON materials(class_id);

ALTER TABLE materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY materials_admin_all ON materials FOR ALL TO authenticated
    USING (is_admin()) WITH CHECK (is_admin());

-- 스태프(owner·teacher parity) — 학원 전체 CRUD
CREATE POLICY materials_staff_all ON materials FOR ALL TO authenticated
    USING (current_user_role() IN ('owner','teacher') AND academy_id = current_user_academy())
    WITH CHECK (current_user_role() IN ('owner','teacher') AND academy_id = current_user_academy());

CREATE POLICY materials_student_read ON materials FOR SELECT TO authenticated
    USING (current_user_role() = 'student' AND (
        (class_id IS NULL AND academy_id = current_user_academy())
        OR class_id IN (SELECT app_my_enrolled_class_ids())
    ));

CREATE POLICY materials_parent_read ON materials FOR SELECT TO authenticated
    USING (current_user_role() = 'parent' AND (
        (class_id IS NULL AND academy_id = current_user_academy())
        OR class_id IN (SELECT app_my_child_class_ids())
    ));

-- ===== Storage 버킷 + RLS =====
-- 경로: {academy_id}/{uuid}.{ext} (row 생성 전 업로드 → 경로에 material_id 불가, questions 선례)
-- question-files와 달리 읽기/쓰기 분리: 학생·학부모는 SELECT만.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('material-files', 'material-files', false, 10 * 1024 * 1024,
        ARRAY['image/png','image/jpeg','application/pdf']::text[])
ON CONFLICT (id) DO UPDATE SET file_size_limit = EXCLUDED.file_size_limit,
        allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY mfiles_staff_all ON storage.objects FOR ALL TO authenticated
    USING (bucket_id = 'material-files'
        AND current_user_role() IN ('owner','teacher')
        AND (storage.foldername(name))[1] = current_user_academy()::text)
    WITH CHECK (bucket_id = 'material-files'
        AND current_user_role() IN ('owner','teacher')
        AND (storage.foldername(name))[1] = current_user_academy()::text);

CREATE POLICY mfiles_member_read ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'material-files'
        AND current_user_role() IN ('student','parent')
        AND (storage.foldername(name))[1] = current_user_academy()::text);

CREATE POLICY mfiles_admin_all ON storage.objects FOR ALL TO authenticated
    USING (bucket_id = 'material-files' AND is_admin())
    WITH CHECK (bucket_id = 'material-files' AND is_admin());
