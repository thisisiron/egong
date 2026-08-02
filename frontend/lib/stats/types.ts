/** 통계 표의 한 행 = 반 하나.
 * 지표가 undefined인 것은 "데이터 없음"이다(0%가 아니다).
 * TanStack Table의 sortUndefined:'last'가 undefined만 인식하므로,
 * service.ts가 RPC의 null을 undefined로 바꿔서 넘긴다.
 */
export interface ClassStatRow {
  classId: string
  className: string
  studentCount: number
  attendancePct?: number
  attendancePctPrev?: number
  submissionPct?: number
  submissionPctPrev?: number
}

/** 전월 대비 변화(%p). 어느 한쪽이라도 없으면 undefined.
 * toFixed(8)로 부동소수점 오차(예: 72.35 - 70 = 2.3499999999999943)를 먼저 지운 뒤 반올림한다.
 */
export function delta(now?: number, prev?: number): number | undefined {
  if (now === undefined || prev === undefined) return undefined
  const diff = Number((now - prev).toFixed(8))
  return Math.round(diff * 10) / 10
}
