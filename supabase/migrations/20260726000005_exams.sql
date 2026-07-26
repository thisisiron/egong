-- 성적·시험 관리(exams) — 테이블·RLS·만점 트리거
-- DDD: 독립 도메인. 시험 하나 = 반 하나(class_id NOT NULL — 공지·자료의 "NULL=학원 전체"와 다름).
-- 초안/공개: published_at NULL = 초안. 학생·학부모는 공개분만 열람.
-- 멱등: CREATE TABLE IF NOT EXISTS / CREATE OR REPLACE / DROP POLICY IF EXISTS 사용.

CREATE TABLE IF NOT EXISTS exams (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    academy_id   uuid NOT NULL REFERENCES academy(id) ON DELETE CASCADE,
    class_id     uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    title        text NOT NULL,
    exam_type    text,
    scope        text,
    exam_date    date NOT NULL,
    max_score    numeric(6,2) NOT NULL CHECK (max_score > 0),
    published_at timestamptz,
    created_by   uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_exams_academy ON exams(academy_id);
CREATE INDEX IF NOT EXISTS idx_exams_class ON exams(class_id, exam_date DESC);

CREATE TABLE IF NOT EXISTS exam_scores (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id    uuid NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    academy_id uuid NOT NULL REFERENCES academy(id) ON DELETE CASCADE,
    class_id   uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    score      numeric(6,2),
    is_absent  boolean NOT NULL DEFAULT false,
    memo       text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (exam_id, student_id),
    CONSTRAINT exam_scores_absent_no_score CHECK (NOT (is_absent AND score IS NOT NULL)),
    CONSTRAINT exam_scores_score_nonneg CHECK (score IS NULL OR score >= 0)
);
CREATE INDEX IF NOT EXISTS idx_exam_scores_exam ON exam_scores(exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_scores_student ON exam_scores(student_id);

-- ===== RLS 헬퍼 (신규 3개) =====

-- 시험의 소유 학원. exam_scores 정책의 exam↔academy 일관성 가드용.
CREATE OR REPLACE FUNCTION public.app_exam_academy(p_exam_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT academy_id FROM exams WHERE id = p_exam_id
$$;

-- 시험이 공개됐는가. exam_scores 정책이 exams를 직접 참조하면 두 정책이 재귀하므로 definer로 끊는다.
CREATE OR REPLACE FUNCTION public.app_exam_is_published(p_exam_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT published_at IS NOT NULL FROM exams WHERE id = p_exam_id), false)
$$;

-- 호출자(학생 본인 또는 학부모의 자녀)의 점수 행이 존재하는 exam_id 집합.
-- app_my_enrolled_class_ids()는 현재 반만 보므로 반을 옮기면 이전 성적이 사라진다.
-- 성적은 이력이 본질이라 "내 점수가 있는 시험"을 열람 근거로 추가한다.
CREATE OR REPLACE FUNCTION public.app_my_scored_exam_ids()
RETURNS setof uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT es.exam_id
  FROM exam_scores es
  WHERE es.student_id IN (
      SELECT id FROM students WHERE user_id = auth.uid()
      UNION
      SELECT sp.student_id FROM student_parent sp
      JOIN parents p ON p.id = sp.parent_id
      WHERE p.user_id = auth.uid()
  )
$$;

-- ===== 만점 초과 트리거 =====
-- score <= exams.max_score는 테이블을 넘나드는 조건이라 CHECK로 표현할 수 없다.
-- 앱단(zod·액션)에도 같은 검증이 있지만, 이건 시드 스크립트·수동 SQL 우회를 막는 최후 방어선.
CREATE OR REPLACE FUNCTION public.exam_scores_check_max()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_max numeric;
BEGIN
    IF NEW.score IS NULL THEN
        RETURN NEW;
    END IF;
    SELECT max_score INTO v_max FROM exams WHERE id = NEW.exam_id;
    IF v_max IS NULL THEN
        RAISE EXCEPTION '존재하지 않는 시험입니다.';
    END IF;
    IF NEW.score > v_max THEN
        RAISE EXCEPTION '점수 %는 시험 만점 %을 초과합니다.', NEW.score, v_max;
    END IF;
    RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_exam_scores_check_max ON exam_scores;
CREATE TRIGGER trg_exam_scores_check_max
    BEFORE INSERT OR UPDATE OF score, exam_id ON exam_scores
    FOR EACH ROW EXECUTE FUNCTION public.exam_scores_check_max();

-- ===== RLS: exams =====
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS exams_admin_all ON exams;
CREATE POLICY exams_admin_all ON exams FOR ALL TO authenticated
    USING (is_admin()) WITH CHECK (is_admin());

-- 스태프(owner·teacher parity) — 학원 전체 CRUD.
-- class_id↔academy 일관성 가드: 없으면 PostgREST 직접 호출로 타 학원 class_id를 가리키는
--   시험을 만들 수 있고, 그 반 학생이 열람 분기로 접근 가능(크로스 테넌트 주입).
--   materials(20260726000001)·공지(20260612000003)와 동일 패턴.
DROP POLICY IF EXISTS exams_staff_all ON exams;
CREATE POLICY exams_staff_all ON exams FOR ALL TO authenticated
    USING (current_user_role() IN ('owner','teacher') AND academy_id = current_user_academy())
    WITH CHECK (current_user_role() IN ('owner','teacher')
        AND academy_id = current_user_academy()
        AND app_class_academy(class_id) = academy_id);

-- 학생 — 공개된 시험만. 현재 반 OR 내 점수가 있는 시험(반 이동 후 이력 보존).
DROP POLICY IF EXISTS exams_student_read ON exams;
CREATE POLICY exams_student_read ON exams FOR SELECT TO authenticated
    USING (current_user_role() = 'student'
        AND published_at IS NOT NULL
        AND (class_id IN (SELECT app_my_enrolled_class_ids())
             OR id IN (SELECT app_my_scored_exam_ids())));

DROP POLICY IF EXISTS exams_parent_read ON exams;
CREATE POLICY exams_parent_read ON exams FOR SELECT TO authenticated
    USING (current_user_role() = 'parent'
        AND published_at IS NOT NULL
        AND (class_id IN (SELECT app_my_child_class_ids())
             OR id IN (SELECT app_my_scored_exam_ids())));

-- ===== RLS: exam_scores =====
ALTER TABLE exam_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS exam_scores_admin_all ON exam_scores;
CREATE POLICY exam_scores_admin_all ON exam_scores FOR ALL TO authenticated
    USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS exam_scores_staff_all ON exam_scores;
CREATE POLICY exam_scores_staff_all ON exam_scores FOR ALL TO authenticated
    USING (current_user_role() IN ('owner','teacher') AND academy_id = current_user_academy())
    WITH CHECK (current_user_role() IN ('owner','teacher')
        AND academy_id = current_user_academy()
        AND app_class_academy(class_id) = academy_id
        AND app_exam_academy(exam_id) = academy_id);

-- 학생·학부모 — 공개된 시험의 "자기 행"만. 타인 점수는 어떤 경로로도 읽히지 않는다.
DROP POLICY IF EXISTS exam_scores_student_read ON exam_scores;
CREATE POLICY exam_scores_student_read ON exam_scores FOR SELECT TO authenticated
    USING (current_user_role() = 'student'
        AND student_id IN (SELECT app_my_student_ids())
        AND app_exam_is_published(exam_id));

DROP POLICY IF EXISTS exam_scores_parent_read ON exam_scores;
CREATE POLICY exam_scores_parent_read ON exam_scores FOR SELECT TO authenticated
    USING (current_user_role() = 'parent'
        AND student_id IN (SELECT app_my_child_student_ids())
        AND app_exam_is_published(exam_id));

-- ===== 권한 회수 =====
-- Supabase는 pg_default_acl로 public 스키마 신규 함수에 anon·authenticated EXECUTE를 직접
-- 부여한다(PUBLIC 경유 아님) → FROM PUBLIC만으로는 anon이 남는다. 셋 다 명시 회수.
REVOKE EXECUTE ON FUNCTION public.app_exam_academy(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.app_exam_is_published(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.app_my_scored_exam_ids() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.exam_scores_check_max() FROM PUBLIC, anon, authenticated;
