import {
  getClassSessions,
  getAttendanceCountsBySessionIds,
} from '@/lib/sessions/service'
import { SessionEditDialog } from './SessionEditDialog'
import { SessionListItem } from './SessionListItem'
import { Button } from '@/components/ui/button'

type Props = {
  classId: string
}

/** 원장의 반 상세에 들어가는 세션 목록 + 추가 버튼.
 *
 * 서버 컴포넌트. attendance count는 batch 1회 쿼리로 회피 (N+1).
 */
export async function SessionsManager({ classId }: Props) {
  const sessions = await getClassSessions(classId, 30)
  const counts = await getAttendanceCountsBySessionIds(sessions.map((s) => s.id))

  return (
    <section className="bg-white border border-amber-100 rounded-lg p-6 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">최근 회차 ({sessions.length})</h2>
        <SessionEditDialog
          mode="create"
          classId={classId}
          trigger={<Button type="button" size="sm">+ 세션 추가</Button>}
        />
      </div>
      <ul className="space-y-0">
        {sessions.length === 0 ? (
          <li className="text-sm text-slate-400 py-2">회차 없음.</li>
        ) : (
          sessions.map((s) => (
            <SessionListItem
              key={s.id}
              session={s}
              attendanceCount={counts.get(s.id) ?? 0}
            />
          ))
        )}
      </ul>
    </section>
  )
}
