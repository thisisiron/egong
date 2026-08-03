import type { ColumnDef } from '@tanstack/react-table'

import type { ClassStatRow } from './types'

/** 표 컬럼 정의. 헤더와 정렬 동작만 담당한다 —
 * 셀 렌더는 ClassStatsTable이 직접 하므로 cell 정의를 두지 않는다.
 *
 * 정렬 가능 컬럼은 출석률·과제 제출률뿐이다 — 두 지표만 분모가 반과 무관하게
 * 같은 뜻(수업 회차, 반 명단)이라 반 간 비교가 성립한다.
 * sortUndefined:'last'는 정렬 방향과 무관하게 빈 값을 맨 아래로 보낸다.
 */
export function buildColumns(): ColumnDef<ClassStatRow>[] {
  return [
    {
      id: 'className',
      accessorKey: 'className',
      header: '반',
      enableSorting: false,
    },
    {
      id: 'studentCount',
      accessorKey: 'studentCount',
      header: '학생',
      enableSorting: false,
    },
    {
      id: 'attendancePct',
      accessorKey: 'attendancePct',
      header: '출석률',
      enableSorting: true,
      sortUndefined: 'last',
    },
    {
      id: 'submissionPct',
      accessorKey: 'submissionPct',
      header: '과제 제출률',
      enableSorting: true,
      sortUndefined: 'last',
    },
  ]
}
