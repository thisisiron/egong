-- Storage bucket for business registration documents uploaded by anon applicants.
-- Path convention: pending/{uuid}.{ext} (anon insert), approved/{academy_id}/{filename} (admin move after approval — Phase 2)

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'business-docs',
  'business-docs',
  false,
  5 * 1024 * 1024,  -- 5MB
  ARRAY['image/png', 'image/jpeg', 'application/pdf']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- anon: pending/* 에만 INSERT 가능. SELECT/DELETE/UPDATE 금지.
CREATE POLICY business_docs_anon_upload ON storage.objects FOR INSERT TO anon
  WITH CHECK (
    bucket_id = 'business-docs'
    AND (storage.foldername(name))[1] = 'pending'
  );

-- admin: 모든 작업 (signed URL 생성용 SELECT 등)
CREATE POLICY business_docs_admin_all ON storage.objects FOR ALL TO authenticated
  USING (
    bucket_id = 'business-docs'
    AND is_admin()
  )
  WITH CHECK (
    bucket_id = 'business-docs'
    AND is_admin()
  );
