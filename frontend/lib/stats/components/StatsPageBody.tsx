import { monthFromParam } from '@/lib/date'

import { getClassStatsForMonth } from '../service'
import { ClassStatsTable } from './ClassStatsTable'
import { MonthNav } from './MonthNav'

type Props = {
  basePath: string
  roleLabel: '원장' | '선생님'
  searchParams: { month?: string }
}

/** 반별 운영 지표. owner·teacher가 공유하고 basePath·roleLabel만 다르다.
 * 권한 범위(owner=학원 전체, teacher=담당 반)는 RPC가 판정하므로 여기서 분기하지 않는다.
 *
 * fail-soft를 쓰지 않는 이유: 데이터 소스가 RPC 하나뿐이라 실패 시 부분적으로
 * 살릴 콘텐츠가 없다. throw해서 라우트 세그먼트의 error.tsx가 잡게 두는 편이 정직하다.
 */
export async function StatsPageBody({ basePath, roleLabel, searchParams }: Props) {
  const month = monthFromParam(searchParams.month)
  const rows = await getClassStatsForMonth(month)

  // 서버에서 기본 정렬(출석률 오름차순)을 적용해 보낸다 — 하이드레이션 전에도,
  // JS가 죽어도 처지는 반이 맨 위에 온다. 빈 값은 항상 맨 아래.
  const sorted = [...rows].sort((a, b) => {
    if (a.attendancePct === undefined && b.attendancePct === undefined) return 0
    if (a.attendancePct === undefined) return 1
    if (b.attendancePct === undefined) return -1
    return a.attendancePct - b.attendancePct
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold">학원 운영 지표</h1>
        <MonthNav month={month} basePath={basePath} />
      </div>

      {roleLabel === '선생님' && rows.length > 0 && (
        <p className="text-sm text-slate-500">담당 반 {rows.length}개</p>
      )}

      {rows.length === 0 ? (
        <p className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-slate-400">
          {roleLabel === '선생님'
            ? '담당하는 반이 없습니다.'
            : '아직 개설된 반이 없습니다.'}
        </p>
      ) : (
        <ClassStatsTable rows={sorted} basePath={basePath} />
      )}
    </div>
  )
}
