/** Date(인스턴트) → KST(UTC+9) 벽시계 기준 연·월·일. 서버 타임존과 무관.
 * KST = UTC+9 고정 (DST 없음).
 */
export function kstParts(d: Date): { year: number; month: number; day: number } {
  const kst = new Date(d.getTime() + 9 * 3600_000)
  return {
    year: kst.getUTCFullYear(),
    month: kst.getUTCMonth() + 1,
    day: kst.getUTCDate(),
  }
}

/** KST 기준 'YYYY-MM-DD'. 서버 타임존과 무관. */
export function ymdKST(d: Date): string {
  const { year, month, day } = kstParts(d)
  return `${year}-${pad2(month)}-${pad2(day)}`
}

/** date가 속한 KST 기준 달의 범위.
 * from/to: 'YYYY-MM-DD' (RPC date 파라미터용 — 양끝 포함),
 * fromIso/toIso: [달 시작, 다음 달 시작) UTC ISO (timestamptz 필터용 — 반개구간).
 */
export function monthRange(date = new Date()) {
  const { year, month } = kstParts(date)
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const nextMonthStart =
    month === 12 ? kstMonthStart(year + 1, 1) : kstMonthStart(year, month + 1)
  return {
    from: `${year}-${pad2(month)}-01`,
    to: `${year}-${pad2(month)}-${pad2(lastDay)}`,
    fromIso: kstMonthStart(year, month).toISOString(),
    toIso: nextMonthStart.toISOString(),
    label: `${year}년 ${month}월`,
  }
}

/** KST 기준 오늘의 [시작, 끝) UTC ISO 범위. 서버 타임존과 무관하게 동작.
 * KST = UTC+9 고정 (DST 없음).
 */
export function todayRangeKST(now = new Date()): {
  fromIso: string
  toIso: string
} {
  // now를 KST 벽시계로 옮겨 날짜를 얻고, 그 날짜의 KST 00:00을 UTC로 환산
  const { year, month, day } = kstParts(now)
  const startUtcMs = Date.UTC(year, month - 1, day) - 9 * 3600_000
  return {
    fromIso: new Date(startUtcMs).toISOString(),
    toIso: new Date(startUtcMs + 24 * 3600_000).toISOString(),
  }
}

/** 'YYYY-MM' 쿼리 파라미터 → 그 달 KST 1일 00:00 인스턴트. 불량·없음이면 이번 달 (throw 없음).
 * 반환 Date의 연·월은 kstParts로 읽을 것 (로컬 getFullYear/getMonth 금지).
 */
export function monthFromParam(param: string | undefined, now = new Date()): Date {
  if (param && /^\d{4}-(0[1-9]|1[0-2])$/.test(param)) {
    const [y, m] = param.split('-').map(Number)
    return kstMonthStart(y, m)
  }
  const { year, month } = kstParts(now)
  return kstMonthStart(year, month)
}

function kstMonthStart(year: number, month: number): Date {
  return new Date(Date.UTC(year, month - 1, 1) - 9 * 3600_000)
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}
