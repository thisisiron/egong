import Link from 'next/link'

import { isCurrentMonthKST, monthParam, monthRange, nextMonth, prevMonth } from '@/lib/date'

type Props = { month: Date; basePath: string }

/** 월 이동. URL 쿼리(?month=YYYY-MM)로 처리해 서버 렌더·공유·뒤로가기를 그대로 얻는다.
 * 미래 달에는 갈 수 없다 — 데이터가 없다.
 */
export function MonthNav({ month, basePath }: Props) {
  const atCurrent = isCurrentMonthKST(month)
  const linkCls =
    'rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500'

  return (
    <div className="flex items-center gap-2">
      <Link
        href={`${basePath}/stats?month=${monthParam(prevMonth(month))}`}
        aria-label="이전 달"
        className={linkCls}
      >
        ‹
      </Link>
      <span className="min-w-28 text-center text-sm font-medium text-slate-900">
        {monthRange(month).label}
      </span>
      {atCurrent ? (
        <span
          aria-disabled="true"
          className="cursor-not-allowed rounded-lg border border-gray-100 px-3 py-1.5 text-sm text-slate-300"
        >
          ›
        </span>
      ) : (
        <Link
          href={`${basePath}/stats?month=${monthParam(nextMonth(month))}`}
          aria-label="다음 달"
          className={linkCls}
        >
          ›
        </Link>
      )}
    </div>
  )
}
