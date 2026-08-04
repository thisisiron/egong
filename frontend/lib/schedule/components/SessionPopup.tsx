import Link from 'next/link'
import type { SessionCellInfo } from '@/lib/teacher-calendar'
import { SESSION_TYPE_META } from '@/lib/sessions/types'
import { EVENT_TYPE_META, type ScheduleEventWithClass } from '@/lib/events/types'
import { EventBadge } from '@/lib/events/components/EventBadge'

type Props = {
  /** ymd 형식 (`YYYY-MM-DD`) — 선택된 날 */
  day: string
  /** 그 날의 회차들 (없으면 empty state) */
  cells: SessionCellInfo[]
  /** 세션 상세 링크 base (예: '/teacher'). 없으면 링크 없이 정보만 표시. */
  sessionLinkBase?: string
  /** 그 날의 이벤트들 (시험/상담) */
  events?: ScheduleEventWithClass[]
}

const STATUS_BADGE: Record<SessionCellInfo['status'], { label: string; cls: string }> = {
  completed: { label: '✓ 완료', cls: 'bg-green-100 text-green-800 border-green-200' },
  in_progress: { label: '⚠ 진행중', cls: 'bg-amber-100 text-amber-800 border-amber-200' },
  empty: { label: '❗ 미입력', cls: 'bg-red-100 text-red-800 border-red-200' },
  upcoming: { label: '📅 예정', cls: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
}

export function SessionPopup({ day, cells, sessionLinkBase, events = [] }: Props) {
  if (cells.length === 0 && events.length === 0) {
    return (
      <div className="mt-3 rounded-lg border border-gray-200 bg-white p-4 text-sm text-slate-500">
        {day}: 수업이 없는 날이에요.
      </div>
    )
  }

  return (
    <div className="mt-3 space-y-2">
      {events.map((e) => {
        const meta = EVENT_TYPE_META[e.type]
        return (
          <div key={e.id} className="rounded-lg border-2 border-slate-200 bg-white p-3 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <span className={`inline-block w-2.5 h-2.5 rounded-full ${meta.dot}`} />
                {e.title}
                {e.class_name && <span className="text-xs text-slate-500 font-normal">· {e.class_name}</span>}
              </div>
              <EventBadge type={e.type} />
            </div>
            {e.memo && <div className="text-xs text-slate-600 mt-1">{e.memo}</div>}
          </div>
        )
      })}
      {cells.map(({ session, status, hasVideo }) => {
        const badge = STATUS_BADGE[status]
        const cancelled = session.cancelled
        const typeMeta = SESSION_TYPE_META[session.type]
        const time = new Date(session.scheduled_at).toLocaleTimeString('ko-KR', {
          timeZone: 'Asia/Seoul',
          hour: '2-digit',
          minute: '2-digit',
        })
        return (
          <div
            key={session.id}
            className={`rounded-lg border-2 bg-white p-3 shadow-sm ${cancelled ? 'border-gray-200 opacity-70' : 'border-indigo-300'}`}
          >
            <div className="flex items-center justify-between">
              <div className={`flex items-center gap-2 text-sm font-semibold ${cancelled ? 'line-through text-slate-400' : ''}`}>
                <span className={`inline-block w-2.5 h-2.5 rounded-full ${typeMeta.dot}`} title={typeMeta.label} />
                {day} ({time}) · {session.class_name}
              </div>
              <span className={`text-xs px-2 py-0.5 rounded border font-semibold ${cancelled ? 'bg-gray-100 text-gray-500 border-gray-200' : badge.cls}`}>
                {cancelled ? '휴강' : badge.label}
              </span>
            </div>
            <div className="text-xs text-slate-600 mt-1">
              {session.title}
              {hasVideo && <span className="ml-2">🎬 영상 있음</span>}
            </div>
            <div className="mt-2 flex gap-2">
              {cancelled ? (
                <span className="text-xs text-slate-400">휴강된 회차예요.</span>
              ) : status === 'upcoming' ? (
                <span className="text-xs text-slate-400">예정된 회차 — 출결 입력은 수업 시간부터 가능</span>
              ) : sessionLinkBase ? (
                <Link
                  href={`${sessionLinkBase}/sessions/${session.id}`}
                  className={
                    status === 'empty' || status === 'in_progress'
                      ? 'inline-block px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded hover:bg-indigo-700'
                      : 'inline-block px-3 py-1.5 border border-slate-200 text-slate-600 text-xs rounded hover:bg-gray-50 hover:border-gray-300'
                  }
                >
                  {status === 'empty' || status === 'in_progress'
                    ? '출결 입력하기 →'
                    : '회차 보기'}
                </Link>
              ) : null}
            </div>
          </div>
        )
      })}
    </div>
  )
}
