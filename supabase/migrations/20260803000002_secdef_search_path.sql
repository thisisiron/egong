-- SECURITY DEFINER 함수의 search_path에 pg_temp를 명시적으로 마지막에 고정한다.
-- pg_temp가 목록에 없으면 Postgres가 릴레이션 조회 시 암묵적으로 맨 앞에서 찾으므로,
-- 임시 테이블을 만들 수 있는 호출자가 definer 함수 내부의 테이블 이름을 가릴 수 있다.
-- 본문은 건드리지 않고 함수 설정만 바꾼다. 멱등 — 재실행해도 같은 상태가 된다.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', r.sig);
  END LOOP;
END $$;
