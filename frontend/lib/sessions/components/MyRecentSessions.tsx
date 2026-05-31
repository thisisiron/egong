import {
  getMyRecentSessions,
  getAttendanceCountsBySessionIds,
} from '@/lib/sessions/service'
import { SessionListItem } from './SessionListItem'

/** 선생님 페이지 하단 — 최근 14일 본인 반 세션 목록 (수정·삭제 진입). */
export async function MyRecentSessions() {
  const sessions = await getMyRecentSessions(14)
  const counts = await getAttendanceCountsBySessionIds(sessions.map((s) => s.id))

  return (
    <section className="bg-white border border-amber-100 rounded-lg p-6 space-y-3">
      <h2 className="font-semibold">내 최근 세션 (최근 14일, {sessions.length}개)</h2>
      <p className="text-xs text-slate-500">
        ✏️ 로 수정, 🗑️ 로 삭제. 출결이 입력된 세션은 삭제 시 출결 row도 함께 사라집니다.
      </p>
      {sessions.length === 0 ? (
        <p className="text-sm text-slate-400">최근 14일 안에 등록된 세션이 없습니다.</p>
      ) : (
        <ul className="space-y-0">
          {sessions.map((s) => (
            <SessionListItem
              key={s.id}
              session={s}
              attendanceCount={counts.get(s.id) ?? 0}
              showClassName={s.class_name}
            />
          ))}
        </ul>
      )}
    </section>
  )
}
