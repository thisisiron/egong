import { TZDate } from '@date-fns/tz'
import { addDays, addMonths, endOfMonth, format, getDate, getMonth, getYear, startOfDay, startOfMonth, subMonths } from 'date-fns'

/** 이 프로젝트의 모든 날짜 판정 기준 타임존. */
const TZ = 'Asia/Seoul'

/** Date(인스턴트)를 KST 벽시계로 보는 TZDate로 옮긴다. */
function toKST(d: Date): TZDate {
  return TZDate.tz(TZ, d.getTime())
}

/** Date(인스턴트) → KST 벽시계 기준 연·월·일. 서버 타임존과 무관. */
export function kstParts(d: Date): { year: number; month: number; day: number } {
  const kst = toKST(d)
  return {
    year: getYear(kst),
    month: getMonth(kst) + 1,
    day: getDate(kst),
  }
}

/** KST 기준 'YYYY-MM-DD'. 서버 타임존과 무관. */
export function ymdKST(d: Date): string {
  return format(toKST(d), 'yyyy-MM-dd')
}

/** date가 속한 KST 기준 달의 범위.
 * from/to: 'YYYY-MM-DD' (RPC date 파라미터용 — 양끝 포함),
 * fromIso/toIso: [달 시작, 다음 달 시작) UTC ISO (timestamptz 필터용 — 반개구간).
 */
export function monthRange(date = new Date()) {
  const kst = toKST(date)
  const first = startOfMonth(kst)
  const last = endOfMonth(kst)
  const nextFirst = addMonths(first, 1)
  return {
    from: format(first, 'yyyy-MM-dd'),
    to: format(last, 'yyyy-MM-dd'),
    fromIso: new Date(first.getTime()).toISOString(),
    toIso: new Date(nextFirst.getTime()).toISOString(),
    label: `${getYear(kst)}년 ${getMonth(kst) + 1}월`,
  }
}

/** KST 기준 오늘의 [시작, 끝) UTC ISO 범위. 서버 타임존과 무관하게 동작. */
export function todayRangeKST(now = new Date()): {
  fromIso: string
  toIso: string
} {
  const start = startOfDay(toKST(now))
  const next = new Date(addDays(start, 1).getTime())
  return {
    fromIso: new Date(start.getTime()).toISOString(),
    toIso: next.toISOString(),
  }
}

/** 'YYYY-MM' 쿼리 파라미터 → 그 달 KST 1일 00:00 인스턴트.
 * 불량·없음이면 이번 달, 미래 달이면 이번 달로 클램프 (throw 없음).
 * 반환 Date의 연·월은 kstParts로 읽을 것 (로컬 getFullYear/getMonth 금지).
 */
export function monthFromParam(param: string | undefined, now = new Date()): Date {
  const current = kstParts(now)
  const currentStart = kstMonthStart(current.year, current.month)
  if (!param || !/^\d{4}-(0[1-9]|1[0-2])$/.test(param)) return currentStart
  const [y, m] = param.split('-').map(Number)
  const requested = kstMonthStart(y, m)
  // 미래 달은 데이터가 없다. 404 대신 이번 달로 조용히 클램프한다.
  return requested.getTime() > currentStart.getTime() ? currentStart : requested
}

/** KST 기준 해당 연·월 1일 00:00의 인스턴트. */
function kstMonthStart(year: number, month: number): Date {
  return new Date(new TZDate(year, month - 1, 1, TZ).getTime())
}

/** 이전 달 KST 1일 00:00. 연 경계는 date-fns가 처리한다. */
export function prevMonth(d: Date): Date {
  const { year, month } = kstParts(d)
  return new Date(subMonths(new TZDate(year, month - 1, 1, TZ), 1).getTime())
}

/** 다음 달 KST 1일 00:00. */
export function nextMonth(d: Date): Date {
  const { year, month } = kstParts(d)
  return new Date(addMonths(new TZDate(year, month - 1, 1, TZ), 1).getTime())
}

/** d가 now와 같은 KST 달인가. 다음 달 버튼 비활성 판정용. */
export function isCurrentMonthKST(d: Date, now = new Date()): boolean {
  const a = kstParts(d)
  const b = kstParts(now)
  return a.year === b.year && a.month === b.month
}

/** URL 쿼리용 'YYYY-MM'. */
export function monthParam(d: Date): string {
  return format(toKST(d), 'yyyy-MM')
}
