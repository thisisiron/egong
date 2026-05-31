-- 출결 UX 단순화: '사전연락'(excused)을 '결석'(absent)으로 통일.
--
-- 배경: 출석률 함수상 absent와 excused는 둘 다 0점으로 동일했고, excused의
-- 유일한 기능은 사유(excused_reason)와 보강필요(needs_makeup) 플래그를 담는 것뿐이었다.
-- 선생님 출결 입력을 출/지/결 3버튼으로 단순화하고, '결'에 선택적 사유(메모)를
-- 달 수 있게 바꾸면서, excused 상태를 더 이상 쓰지 않는다.
--
-- excused_reason 컬럼은 그대로 두되 이제 의미는 "결석 메모(선택)"다.
-- enum 값 'excused'는 Postgres에서 제거가 번거로우므로 남겨두되 미사용(dormant) 상태.
--
-- 멱등: 재실행해도 안전 (이미 absent면 영향 없음).

update public.attendance
set status = 'absent'
where status = 'excused';

comment on column public.attendance.excused_reason is
  '결석 메모(선택). 과거 excused(사전연락) 사유였으나 이제 일반 결석 메모로 통일.';
