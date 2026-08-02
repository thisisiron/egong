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

/** 지표 표시 문자열. undefined는 "데이터 없음"(—)이고 0은 진짜 0%다 — 둘을 절대 섞지 않는다.
 * `!value` 같은 falsy 가드로 "단순화"하면 0이 —로 바뀌는 회귀가 생기므로 반드시 `=== undefined`로만 판정한다.
 */
export function formatMetric(value?: number): string {
  if (value === undefined) return '—'
  return `${Math.round(value)}%`
}

export type DeltaTone = 'none' | 'flat' | 'up' | 'down'

export interface DeltaDisplay {
  text: string
  tone: DeltaTone
}

/** delta()의 결과를 표시용 데이터로 가공한다. 색만으로 방향을 전달하지 않도록
 * 화살표(▲/▼)와 부호(+/-)를 텍스트에 함께 넣는다 — 어느 한쪽만 지원되지 않는 환경에서도
 * 나머지 하나가 방향을 전달한다.
 * d가 undefined면 비교 불가(신설 반 등), 0이면 변화 없음 — 이 둘은 방향이 없으므로 화살표를 붙이지 않는다.
 */
export function formatDelta(d?: number): DeltaDisplay {
  if (d === undefined) return { text: '—', tone: 'none' }
  if (d === 0) return { text: '— 0%p', tone: 'flat' }
  const arrow = d < 0 ? '▼' : '▲'
  const sign = d < 0 ? '-' : '+'
  return { text: `${arrow} ${sign}${Math.abs(d)}%p`, tone: d < 0 ? 'down' : 'up' }
}
