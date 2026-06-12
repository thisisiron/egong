import { SessionEditDialog } from './SessionEditDialog'
import { SessionDeleteDialog } from './SessionDeleteDialog'
import type { Session } from '@/lib/sessions/types'

type Props = {
  session: Session
  /** 호출자가 batch로 미리 조회해서 넘김 (N+1 회피). 0 허용. */
  attendanceCount: number
  /** 선생님 페이지에서 반 이름 같이 표시. */
  showClassName?: string
}

/** 한 세션 행 — 시각·제목·영상아이콘·편집·삭제 버튼.
 *
 * 서버 컴포넌트지만 props만 받는 dumb component (DB 호출 없음).
 */
export function SessionListItem({ session, attendanceCount, showClassName }: Props) {
  const when = new Date(session.scheduled_at).toLocaleString('ko-KR', {
    month: '2-digit', day: '2-digit', weekday: 'short',
    hour: '2-digit', minute: '2-digit',
  })

  return (
    <li className="flex justify-between items-center border-b py-2 text-sm gap-2">
      <span className="flex-1 min-w-0">
        <span className="font-medium">{when}</span>
        <span className="mx-1 text-slate-300">·</span>
        <span>{session.title}</span>
        {showClassName && (
          <span className="ml-2 text-xs text-slate-500">[{showClassName}]</span>
        )}
        {session.video_url && (
          <span className="ml-2" title="영상 등록됨">🎬</span>
        )}
      </span>
      <span className="flex gap-1 shrink-0">
        <SessionEditDialog
          mode="edit"
          existing={session}
          trigger={
            <button
              type="button"
              className="px-2 py-1 text-xs rounded hover:bg-gray-50"
              aria-label="수정"
            >
              ✏️
            </button>
          }
        />
        <SessionDeleteDialog
          sessionId={session.id}
          sessionTitle={session.title}
          attendanceCount={attendanceCount}
          trigger={
            <button
              type="button"
              className="px-2 py-1 text-xs rounded hover:bg-red-50"
              aria-label="삭제"
            >
              🗑️
            </button>
          }
        />
      </span>
    </li>
  )
}
