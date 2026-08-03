-- SECURITY DEFINER 함수의 search_path에 pg_temp를 명시적으로 마지막에 고정한다.
-- pg_temp가 목록에 없으면 Postgres가 릴레이션 조회 시 암묵적으로 맨 앞에서 찾으므로,
-- 임시 테이블을 만들 수 있는 호출자가 definer 함수 내부의 테이블 이름을 가릴 수 있다.
-- 본문은 건드리지 않고 함수 설정만 바꾼다. 멱등 — 재실행해도 같은 상태가 된다.
--
-- 확장(extension)이 소유한 함수는 대상에서 제외한다: ALTER FUNCTION은 소유자만
-- 실행할 수 있는데, 확장이 설치한 SECURITY DEFINER 함수의 소유자는 그 확장이지
-- 우리 마이그레이션 롤이 아니다. 신선한 환경에서 그런 함수가 하나라도 public에
-- 있으면 "must be owner of function"으로 이 DO 블록 전체가 중단된다.
-- 이 원격 프로젝트에는 이미 적용돼 있으므로(적용 당시 대상 집합에 확장 소유
-- 함수가 없었다) 이 변경을 다시 push할 필요는 없다 — 신선한 환경을 위한 방어다.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
      AND NOT EXISTS (
        SELECT 1 FROM pg_depend d
        WHERE d.objid = p.oid AND d.deptype = 'e'
      )
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', r.sig);
  END LOOP;
END $$;
