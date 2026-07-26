-- 성적 — 점수 행의 명단·반·학원 일치 가드 (액션 검증의 DB 측 2겹)
-- 배경: "이 학생이 이 시험의 응시 대상인가"는 RLS로 표현할 수 없어 서버 액션이 검사하는데,
--   그 검사가 실제로 막는지 증명할 자동 테스트가 없었다(브라우저 e2e로는 위조 payload를
--   서버 액션에 직접 보낼 수 없고, 단위 러너는 스펙 §8.4가 배제). 만점 초과를 이미
--   액션+트리거 2겹으로 막았으므로 같은 패턴을 적용해 검증 SQL로 증명 가능하게 만든다.
-- 함께 닫는 것: exam_scores.class_id / academy_id가 exams와 어긋나는 주입(Task 1 리뷰 deferred).
-- 술어는 액션·service·리포트 RPC와 반드시 동일해야 한다 —
--   joined_at <= exam_date AND (left_at IS NULL OR left_at >= exam_date)

CREATE OR REPLACE FUNCTION public.exam_scores_check_roster()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
    v_class   uuid;
    v_date    date;
    v_academy uuid;
BEGIN
    SELECT e.class_id, e.exam_date, e.academy_id
    INTO v_class, v_date, v_academy
    FROM exams e WHERE e.id = NEW.exam_id;

    IF v_class IS NULL THEN
        RAISE EXCEPTION '존재하지 않는 시험입니다.';
    END IF;

    IF NEW.class_id <> v_class THEN
        RAISE EXCEPTION '점수의 반이 시험의 반과 일치하지 않습니다.';
    END IF;

    IF NEW.academy_id <> v_academy THEN
        RAISE EXCEPTION '점수의 학원이 시험의 학원과 일치하지 않습니다.';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM class_students cs
        WHERE cs.class_id = v_class
          AND cs.student_id = NEW.student_id
          AND cs.joined_at <= v_date
          AND (cs.left_at IS NULL OR cs.left_at >= v_date)
    ) THEN
        RAISE EXCEPTION '이 시험의 응시 대상이 아닌 학생입니다.';
    END IF;

    RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_exam_scores_check_roster ON exam_scores;
CREATE TRIGGER trg_exam_scores_check_roster
    BEFORE INSERT OR UPDATE OF exam_id, student_id, class_id, academy_id ON exam_scores
    FOR EACH ROW EXECUTE FUNCTION public.exam_scores_check_roster();

REVOKE EXECUTE ON FUNCTION public.exam_scores_check_roster() FROM PUBLIC, anon, authenticated;
