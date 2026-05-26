-- Academy application: 외부 학원 원장이 도입을 신청하는 공개 폼의 저장소.
-- anon insert 가능, admin만 read/write.

CREATE TYPE application_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE business_type AS ENUM ('individual', 'corporate', 'tutoring', 'planned');
CREATE TYPE academy_student_count AS ENUM ('under_50', '50_to_200', 'over_200');

CREATE TABLE academy_applications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    status application_status NOT NULL DEFAULT 'pending',

    -- 신청자 (원장)
    applicant_name text NOT NULL,
    applicant_email text NOT NULL,
    applicant_phone text NOT NULL,

    -- 학원
    academy_name text NOT NULL,
    academy_region text,
    academy_student_count academy_student_count,
    inquiry_message text,

    -- 사업자
    business_type business_type NOT NULL,
    business_name text NOT NULL,
    business_owner_name text NOT NULL,
    business_number text,
    registration_file_path text,

    -- review (Phase 2)
    created_at timestamptz NOT NULL DEFAULT now(),
    reviewed_at timestamptz,
    reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
    review_note text,
    created_academy_id uuid REFERENCES academy(id) ON DELETE SET NULL
);

CREATE INDEX idx_applications_status ON academy_applications(status, created_at DESC);

ALTER TABLE academy_applications ENABLE ROW LEVEL SECURITY;

-- anon: insert만 가능, 모든 다른 작업 금지
CREATE POLICY application_anon_insert ON academy_applications FOR INSERT TO anon
  WITH CHECK (true);

-- admin: 모든 작업
CREATE POLICY application_admin_all ON academy_applications FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());
