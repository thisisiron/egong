import type { SessionCellInfo } from '@/lib/teacher-calendar'
import { ymd } from '@/lib/teacher-calendar'

type Props = {
  year: number
  cells: SessionCellInfo[]
}

const STATUS_COLOR: Record<SessionCellInfo['status'], string> = {
  completed: 'bg-green-300',
  in_progress: 'bg-amber-300',
  empty: 'bg-red-300',
  upcoming: 'bg-indigo-200',
}

export function CalendarYear({ year, cells }: Props) {
  // 1년 = 366일 grid, 일별로 가장 우선순위 높은 상태
  const byDay = new Map<string, SessionCellInfo['status']>()
  for (const c of cells) {
    const d = new Date(c.session.scheduled_at)
    if (d.getFullYear() !== year) continue
    const key = ymd(d)
    const prev = byDay.get(key)
    // priority: empty > in_progress > upcoming > completed
    const priority: Record<SessionCellInfo['status'], number> = {
      empty: 4, in_progress: 3, upcoming: 2, completed: 1,
    }
    if (!prev || priority[c.status] > priority[prev]) byDay.set(key, c.status)
  }

  // 366 cells (1/1 ~ 12/31). 누락된 leap day는 비어있게.
  const cellsArr: { day: string; status: SessionCellInfo['status'] | null }[] = []
  const start = new Date(year, 0, 1)
  for (let i = 0; i < 366; i += 1) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    if (d.getFullYear() !== year) break
    const key = ymd(d)
    cellsArr.push({ day: key, status: byDay.get(key) ?? null })
  }

  const total = cells.length
  const completed = cells.filter((c) => c.status === 'completed').length
  const rate = total > 0 ? Math.round((completed / total) * 100) : 0

  return (
    <div>
      <div className="grid grid-cols-[repeat(53,1fr)] gap-[2px]">
        {cellsArr.map(({ day, status }) => (
          <div
            key={day}
            title={`${day}${status ? ` · ${status}` : ''}`}
            className={`aspect-square rounded-sm ${status ? STATUS_COLOR[status] : 'bg-slate-100'}`}
          />
        ))}
      </div>
      <div className="mt-3 text-xs text-slate-500 text-center">
        {year}년 — 총 {total}회차 · 완료 {completed}회차 ({rate}%)
      </div>
    </div>
  )
}
