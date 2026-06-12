export function monthRange(date = new Date()) {
  const from = new Date(date.getFullYear(), date.getMonth(), 1)
  const to = new Date(date.getFullYear(), date.getMonth() + 1, 0)
  return {
    from: ymd(from),
    to: ymd(to),
    label: `${from.getFullYear()}년 ${from.getMonth() + 1}월`,
  }
}

export function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** KST 기준 오늘의 [시작, 끝) UTC ISO 범위. 서버 타임존과 무관하게 동작.
 * KST = UTC+9 고정 (DST 없음).
 */
export function todayRangeKST(now = new Date()): {
  fromIso: string
  toIso: string
  label: string
} {
  // now를 KST 벽시계로 옮겨 날짜를 얻고, 그 날짜의 KST 00:00을 UTC로 환산
  const kst = new Date(now.getTime() + 9 * 3600_000)
  const y = kst.getUTCFullYear()
  const m = kst.getUTCMonth()
  const d = kst.getUTCDate()
  const startUtcMs = Date.UTC(y, m, d) - 9 * 3600_000
  return {
    fromIso: new Date(startUtcMs).toISOString(),
    toIso: new Date(startUtcMs + 24 * 3600_000).toISOString(),
    label: `${y}년 ${m + 1}월 ${d}일`,
  }
}

/** 'YYYY-MM' 쿼리 파라미터 → 그 달 1일 Date. 불량·없음이면 이번 달 (throw 없음). */
export function monthFromParam(param: string | undefined, now = new Date()): Date {
  if (param && /^\d{4}-(0[1-9]|1[0-2])$/.test(param)) {
    const [y, m] = param.split('-').map(Number)
    return new Date(y, m - 1, 1)
  }
  return new Date(now.getFullYear(), now.getMonth(), 1)
}
