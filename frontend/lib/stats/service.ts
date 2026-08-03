import 'server-only'

import { ymdKST } from '@/lib/date'
import { createClient } from '@/lib/supabase/server'

import type { ClassStatRow } from './types'

/** null → undefined. TanStack Table의 sortUndefined:'last'는 null을 인식하지 않는다.
 * 생성된 database.types.ts는 이 RPC의 percent 필드들을 (Supabase codegen이 테이블
 * 반환 함수의 nullability를 못 따라가는 한계로) non-nullable `number`로 선언한다 —
 * 그래서 아래 `=== null` 검사는 타입상으로는 절대 참이 될 수 없어 보이지만 실제
 * 런타임 값은 null일 수 있다. 이 검사를 지우면 컴파일 에러 없이 조용히
 * null이 undefined 대신 그대로 흘러 들어간다. */
function opt(v: number | null): number | undefined {
  return v === null ? undefined : Number(v)
}

/** 선택 월의 반별 지표. 권한 판정은 RPC 안에서 끝나므로 여기서 역할을 따지지 않는다.
 * 비인가 호출은 빈 배열로 돌아온다(에러가 아니다).
 * DB 에러는 throw — 라우트 세그먼트의 error.tsx가 잡는다.
 */
export async function getClassStatsForMonth(month: Date): Promise<ClassStatRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('class_stats_for_month', {
    p_month: ymdKST(month),
  })
  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => ({
    classId: r.class_id,
    className: r.class_name,
    studentCount: r.student_count,
    attendancePct: opt(r.attendance_pct),
    attendancePctPrev: opt(r.attendance_pct_prev),
    submissionPct: opt(r.submission_pct),
    submissionPctPrev: opt(r.submission_pct_prev),
  }))
}
