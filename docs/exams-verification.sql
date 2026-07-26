-- 검증 SQL (문서 전용 — 마이그레이션 아님. supabase/migrations/에 두지 말 것)
--
-- exam_report_for_student (supabase/migrations/20260726000006_exam_rpc.sql)의
-- class_avg_pct · class_max_pct · taker_count 집계 수식이 실제 여러 행을 놓고 돈 적이 없다
-- (개발 시드는 반마다 학생 1명뿐이라 "반 평균"이 항상 본인 점수와 같아진다). 이 스크립트는
-- 이 세 값을 손으로 계산한 기대값과 실제 RPC 출력을 나란히 놓고 사람이 눈으로 비교할 수 있게 한다.
--
-- 20260726000005_exams.sql / 20260726000007_exam_roster_guard.sql과 같은 스타일:
-- 임시 데이터를 만들고 → 확인하고 싶은 쿼리를 옆에 기대값 주석과 함께 두고 → 마지막에 전부 지운다.
--
-- 공유 개발 DB(backend/.env의 DATABASE_URL)에 대해 돌린다. 기존 학원·반·학생을 전혀 건드리지
-- 않도록 학원·반·학생까지 전부 이 스크립트 안에서 새로 만든다(개발 DB에 실제 학생이 3명뿐이라
-- 기존 반 하나를 빌려 쓰면 3인 이상 응시 시나리오를 못 만든다). 트랜잭션 하나로 묶고,
-- 사람이 직접 psql로 돌릴 경우 마지막 DELETE 블록까지 반드시 실행할 것.

BEGIN;

-- ── 준비: 임시 학원·반·학생 5명 ──────────────────────────────────────────────
WITH new_academy AS (
    INSERT INTO academy (name) VALUES ('__verify_exams_academy__')
    RETURNING id
),
new_class AS (
    INSERT INTO classes (academy_id, name, level)
    SELECT id, '__verify_exams_class__', 'middle' FROM new_academy
    RETURNING id, academy_id
),
new_students AS (
    INSERT INTO students (academy_id, name)
    SELECT c.academy_id, s.name
    FROM new_class c, (VALUES
        ('__verify_A__'), -- 80점
        ('__verify_B__'), -- 60점
        ('__verify_C__'), -- 100점
        ('__verify_D__'), -- 미응시(is_absent)
        ('__verify_E__')  -- 미입력(exam_scores 행 없음)
    ) AS s(name)
    RETURNING id, name, academy_id
)
SELECT * FROM new_students;
-- (위 SELECT는 그냥 확인용 출력. 실제로는 아래에서 이 id들을 다시 조회해 쓴다 — CTE는
--  하나의 문장 안에서만 살아있어서 뒤 INSERT들과 공유할 수 없다.)

-- ── 시험 생성(공개 상태, 만점 100, 최근 12개월 이내 날짜) ──────────────────
INSERT INTO exams (academy_id, class_id, title, exam_date, max_score, published_at)
SELECT c.academy_id, c.id, '__verify_exams_exam__', CURRENT_DATE - 14, 100, now()
FROM classes c WHERE c.name = '__verify_exams_class__';

-- ── 명단 등록: 5명 전부 시험일 기준 재적 ────────────────────────────────────
INSERT INTO class_students (class_id, student_id, joined_at, left_at)
SELECT c.id, s.id, CURRENT_DATE - 365, NULL
FROM classes c, students s
WHERE c.name = '__verify_exams_class__' AND s.academy_id = c.academy_id;

-- ── 점수 입력: A=80, B=60, C=100, D=미응시, E=행 없음(미입력) ───────────────
INSERT INTO exam_scores (exam_id, student_id, academy_id, class_id, score, is_absent)
SELECT e.id, s.id, e.academy_id, e.class_id,
       CASE s.name
           WHEN '__verify_A__' THEN 80
           WHEN '__verify_B__' THEN 60
           WHEN '__verify_C__' THEN 100
       END,
       s.name = '__verify_D__'
FROM exams e
JOIN students s ON s.academy_id = e.academy_id
WHERE e.title = '__verify_exams_exam__'
  AND s.name IN ('__verify_A__', '__verify_B__', '__verify_C__', '__verify_D__');
-- __verify_E__는 일부러 exam_scores 행을 만들지 않는다 (미입력 케이스).

-- ── 손으로 계산한 기대값 ────────────────────────────────────────────────────
-- 실제 응시자(score IS NOT NULL AND is_absent = false) = A, B, C 세 명.
--   A: 80/100*100 = 80.0%
--   B: 60/100*100 = 60.0%
--   C: 100/100*100 = 100.0%
-- class_avg_pct = round((80.0 + 60.0 + 100.0) / 3, 1) = round(80.0, 1)     = 80.0
-- class_max_pct = round(max(80.0, 60.0, 100.0), 1)                        = 100.0
-- taker_count   = 3   (D는 is_absent=true라 제외, E는 행 자체가 없어 제외)

-- ── RPC 자체의 권한 가드 통과시키기 ──────────────────────────────────────
-- exam_report_for_student는 내부에서 app_can_view_student_scores(p_student_id)로
-- auth.uid() 기반 권한을 확인한다. psycopg로 postgres 슈퍼유저 세션에서 직접 부르면
-- auth.uid()가 NULL이라 이 가드에서 항상 막혀 빈 결과만 나온다(권한 로직 자체는 이미
-- 20260726000006 리뷰에서 검증됨 — 여기서 다시 확인할 대상이 아니다). 집계 수식을 보려면
-- 가드를 통과해야 하므로, 이미 시드돼 있는 실제 admin 계정으로 세션을 "로그인"시킨다
-- (admin은 학원 무관 전권이라 이 검증 전용 임시 학생을 봐도 무방하고, 이 세션 설정은
--  커넥션이 끊기면 사라지는 GUC라 다른 세션·실제 데이터에 아무 영향이 없다).
SELECT set_config(
    'request.jwt.claim.sub',
    (SELECT id::text FROM users WHERE role = 'admin' LIMIT 1),
    false
);

-- ── 실제 RPC 출력 (학생별로 my_score/my_is_absent만 다르고, 세 집계 컬럼은
--    exam_id 기준 LATERAL 서브쿼리라 어느 학생으로 호출해도 동일해야 한다) ──
SELECT s.name AS queried_as,
       r.my_score, r.my_is_absent,
       r.class_avg_pct, r.class_max_pct, r.taker_count
FROM students s
CROSS JOIN LATERAL exam_report_for_student(s.id, CURRENT_DATE - 365, CURRENT_DATE) r
WHERE s.academy_id = (SELECT academy_id FROM classes WHERE name = '__verify_exams_class__')
  AND r.title = '__verify_exams_exam__'
ORDER BY s.name;
-- 기대: 5행 모두 class_avg_pct=80.0, class_max_pct=100.0, taker_count=3.
--   A행: my_score=80,  my_is_absent=false
--   B행: my_score=60,  my_is_absent=false
--   C행: my_score=100, my_is_absent=false
--   D행: my_score=NULL, my_is_absent=true   (미응시도 시험 행 자체는 리포트에 나와야 함)
--   E행: my_score=NULL, my_is_absent=false  (미입력 — 시험은 나오되 내 점수만 빔)

-- ── 정리: 만든 것 전부 삭제(역순) ───────────────────────────────────────────
DELETE FROM exam_scores WHERE exam_id IN (SELECT id FROM exams WHERE title = '__verify_exams_exam__');
DELETE FROM class_students WHERE class_id IN (SELECT id FROM classes WHERE name = '__verify_exams_class__');
DELETE FROM exams WHERE title = '__verify_exams_exam__';
DELETE FROM students WHERE name IN
    ('__verify_A__', '__verify_B__', '__verify_C__', '__verify_D__', '__verify_E__');
DELETE FROM classes WHERE name = '__verify_exams_class__';
DELETE FROM academy WHERE name = '__verify_exams_academy__';

COMMIT;

-- 사람이 손으로 이 파일을 psql/Studio에서 돌릴 때: 위 SELECT 결과를 위 "기대값"과 비교한 뒤
-- COMMIT까지 반드시 실행해서 정리 블록이 실제로 적용되게 할 것. (자동화 러너를 쓸 경우
-- BEGIN 없이 autocommit으로 문장별 실행해도 되지만, 그때도 정리 DELETE 6개는 끝까지 실행해야 한다.)
