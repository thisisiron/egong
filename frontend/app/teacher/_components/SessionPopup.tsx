import Link from 'next/link'
import type { SessionCellInfo } from '@/lib/teacher-calendar'

type Props = {
  /** ymd 형식 (`YYYY-MM-DD`) — 선택된 날 */
  day: string
  /** 그 날의 회차들 (없으면 empty state) */
  cells: SessionCellInfo[]
}

const STATUS_BADGE: Record<SessionCellInfo['status'], { label: string; cls: string }> = {
  completed: { label: '✓ 완료', cls: 'bg-green-100 text-green-800 border-green-200' },
  in_progress: { label: '⚠ 진행중', cls: 'bg-amber-100 text-amber-800 border-amber-200' },
  empty: { label: '❗ 미입력', cls: 'bg-red-100 text-red-800 border-red-200' },
  upcoming: { label: '📅 예정', cls: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
}

export function SessionPopup({ day, cells }: Props) {
  if (cells.length === 0) {
    return (
      <div className="mt-3 rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500">
        {day}: 수업이 없는 날이에요.
      </div>
    )
  }

  return (
    <div className="mt-3 space-y-2">
      {cells.map(({ session, status, hasVideo }) => {
        const badge = STATUS_BADGE[status]
        const time = new Date(session.scheduled_at).toLocaleTimeString('ko-KR', {
          hour: '2-digit',
          minute: '2-digit',
        })
        return (
          <div
            key={session.id}
            className="rounded-lg border-2 border-slate-300 bg-white p-3 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">
                {day} ({time}) · {session.class_name}
              </div>
              <span className={`text-xs px-2 py-0.5 rounded border font-semibold ${badge.cls}`}>
                {badge.label}
              </span>
            </div>
            <div className="text-xs text-slate-600 mt-1">
              {session.title}
              {hasVideo && <span className="ml-2">🎬 영상 있음</span>}
            </div>
            <div className="mt-2 flex gap-2">
              {status === 'upcoming' ? (
                <span className="text-xs text-slate-400">예정된 회차 — 출결 입력은 수업 시간부터 가능</span>
              ) : (
                <Link
                  href={`/teacher/sessions/${session.id}`}
                  className={
                    status === 'empty' || status === 'in_progress'
                      ? 'inline-block px-3 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded hover:bg-slate-800'
                      : 'inline-block px-3 py-1.5 border border-slate-200 text-slate-600 text-xs rounded hover:bg-slate-50'
                  }
                >
                  {status === 'empty' || status === 'in_progress'
                    ? '출결 입력하기 →'
                    : '회차 보기'}
                </Link>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
