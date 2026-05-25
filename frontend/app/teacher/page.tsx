import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser } from '@/lib/auth'

function dayBounds(daysFromToday: number) {
  const d = new Date()
  d.setDate(d.getDate() + daysFromToday)
  d.setHours(0, 0, 0, 0)
  const end = new Date(d)
  end.setHours(23, 59, 59, 999)
  return { from: d.toISOString(), to: end.toISOString() }
}

function weekRange() {
  const now = new Date()
  const dow = now.getDay() // 0=Sun
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((dow + 6) % 7))
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)
  return { from: monday.toISOString(), to: sunday.toISOString() }
}

type SessionRow = {
  id: string
  scheduled_at: string
  title: string
  classes: { id: string; name: string } | { id: string; name: string }[] | null
}

export default async function TeacherDashboard({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab = 'today' } = await searchParams
  const range = tab === 'week' ? weekRange() : dayBounds(0)

  const user = await getSessionUser()
  if (!user) return null

  const supabase = await createClient()

  // RLS already filters sessions to classes where this teacher is homeroom,
  // so we just query sessions in the date range.
  const { data: sessions } = await supabase
    .from('sessions')
    .select('id, scheduled_at, title, classes(id, name)')
    .gte('scheduled_at', range.from)
    .lte('scheduled_at', range.to)
    .order('scheduled_at')

  const rows = (sessions ?? []) as unknown as SessionRow[]

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">내 수업</h1>
      <div className="flex gap-2 text-sm">
        <Link
          href="/teacher?tab=today"
          className={`px-3 py-1.5 rounded ${
            tab !== 'week' ? 'bg-slate-900 text-white' : 'bg-white border'
          }`}
        >
          오늘
        </Link>
        <Link
          href="/teacher?tab=week"
          className={`px-3 py-1.5 rounded ${
            tab === 'week' ? 'bg-slate-900 text-white' : 'bg-white border'
          }`}
        >
          이번주
        </Link>
      </div>
      <ul className="space-y-2">
        {rows.map((s) => {
          const cls = Array.isArray(s.classes) ? s.classes[0] : s.classes
          return (
            <li key={s.id}>
              <Link
                href={`/teacher/sessions/${s.id}`}
                className="block bg-white border rounded-lg p-4 hover:border-slate-400"
              >
                <div className="text-xs text-slate-500">
                  {new Date(s.scheduled_at).toLocaleString('ko-KR')}
                </div>
                <div className="font-semibold mt-1">
                  {cls?.name ?? '-'} — {s.title}
                </div>
              </Link>
            </li>
          )
        })}
        {rows.length === 0 ? (
          <li className="text-sm text-slate-400 text-center py-8">
            예정된 수업이 없습니다.
          </li>
        ) : null}
      </ul>
    </div>
  )
}
