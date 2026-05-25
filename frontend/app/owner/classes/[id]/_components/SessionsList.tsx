import { createClient } from '@/lib/supabase/server'

export async function SessionsList({ classId }: { classId: string }) {
  const supabase = await createClient()
  const { data: sessions } = await supabase
    .from('sessions')
    .select('id, scheduled_at, title, video_url')
    .eq('class_id', classId)
    .order('scheduled_at', { ascending: false })
    .limit(20)

  return (
    <section className="bg-white border rounded-lg p-6 space-y-3">
      <h2 className="font-semibold">최근 회차 ({sessions?.length ?? 0})</h2>
      <ul className="text-sm space-y-1">
        {(sessions ?? []).map((s) => (
          <li
            key={s.id}
            className="flex justify-between border-b py-1"
          >
            <span>
              {new Date(s.scheduled_at).toLocaleString('ko-KR')} — {s.title}
            </span>
            <span className="text-slate-400">{s.video_url ? '🎬' : ''}</span>
          </li>
        ))}
        {!sessions || sessions.length === 0 ? (
          <li className="text-slate-400">회차 없음.</li>
        ) : null}
      </ul>
    </section>
  )
}
