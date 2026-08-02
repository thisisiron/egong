import 'server-only'

import { ymdKST } from '@/lib/date'
import { createClient } from '@/lib/supabase/server'

import type { ClassStatRow } from './types'

/** null → undefined. TanStack Table의 sortUndefined:'last'는 null을 인식하지 않는다. */
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
