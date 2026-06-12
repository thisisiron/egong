import Link from 'next/link'
import { formatTimeKR } from '@/lib/format'
import type { TodaySessionSummary } from '../types'

type Props = { items: TodaySessionSummary[] }

/** 오늘 세션 카드 리스트 — 완료(실선·녹색)/부분(실선·amber)/미입력(점선·회색) 3종. */
export function TodayAttendance({ items }: Props) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-slate-400 bg-white border border-gray-200 rounded-lg p-6 text-center">
        오늘 수업이 없습니다.
      </p>
    )
  }
  return (
    <div className="space-y-2">
      {items.map((s) => {
        const unmarked = s.marked === 0
        const complete = s.roster_count > 0 && s.marked >= s.roster_count
        return (
          <Link
            key={s.session_id}
            href={`/owner/classes/${s.class_id}`}
            className={`block border rounded-lg p-3 transition-colors ${
              unmarked
                ? 'border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100'
                : 'border-gray-200 bg-white hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-between">
              <span
                className={`font-medium ${unmarked ? 'text-slate-500' : 'text-slate-900'}`}
              >
                {formatTimeKR(s.scheduled_at)} · {s.class_name}
              </span>
              <span
                className={`text-xs ${
                  complete
                    ? 'text-green-600'
                    : unmarked
                      ? 'text-slate-400'
                      : 'text-indigo-600 font-medium'
                }`}
              >
                {complete
                  ? `입력 완료 ${s.marked}/${s.roster_count}`
                  : unmarked
                    ? `미입력 0/${s.roster_count}`
                    : `입력 중 ${s.marked}/${s.roster_count}`}
              </span>
            </div>
            {unmarked ? (
              <div className="mt-1.5 text-xs text-slate-400">
                아직 출결이 입력되지 않았습니다
              </div>
            ) : (
              <div className="mt-1.5 flex gap-1.5 text-xs">
                <span className="bg-green-100 text-green-800 rounded-full px-2 py-0.5">
                  출석 {s.present}
                </span>
                <span className="bg-amber-100 text-amber-800 rounded-full px-2 py-0.5">
                  지각 {s.late}
                </span>
                <span className="bg-red-100 text-red-700 rounded-full px-2 py-0.5">
                  결석 {s.absent}
                </span>
              </div>
            )}
          </Link>
        )
      })}
    </div>
  )
}
