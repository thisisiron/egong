import Link from 'next/link'
import type { SessionCellInfo } from '@/lib/teacher-calendar'
import { kstParts, ymdKST } from '@/lib/date'

const DAY_MS = 24 * 60 * 60 * 1000

type Props = {
  year: number
  cells: SessionCellInfo[]
  basePath: string
}

const STATUS_COLOR: Record<SessionCellInfo['status'], string> = {
  completed: 'bg-green-300',
  in_progress: 'bg-amber-300',
  empty: 'bg-red-300',
  upcoming: 'bg-indigo-200',
}

export function CalendarYear({ year, cells, basePath }: Props) {
  // 1년 = 366일 grid, 일별로 가장 우선순위 높은 상태
  const byDay = new Map<string, SessionCellInfo['status']>()
  for (const c of cells) {
    const d = new Date(c.session.scheduled_at)
    if (kstParts(d).year !== year) continue
    const key = ymdKST(d)
    const prev = byDay.get(key)
    // priority: empty > in_progress > upcoming > completed
    const priority: Record<SessionCellInfo['status'], number> = {
      empty: 4, in_progress: 3, upcoming: 2, completed: 1,
    }
    if (!prev || priority[c.status] > priority[prev]) byDay.set(key, c.status)
  }

  // 366 cells (1/1 ~ 12/31). 누락된 leap day는 비어있게.
  // UTC 자정 인스턴트는 KST 같은 날 09:00 — ymdKST로 읽으면 그대로 그 날짜.
  const cellsArr: { day: string; status: SessionCellInfo['status'] | null }[] = []
  const start = Date.UTC(year, 0, 1)
  for (let i = 0; i < 366; i += 1) {
    const d = new Date(start + i * DAY_MS)
    if (kstParts(d).year !== year) break
    const key = ymdKST(d)
    cellsArr.push({ day: key, status: byDay.get(key) ?? null })
  }

  const total = cells.length
  const completed = cells.filter((c) => c.status === 'completed').length
  const rate = total > 0 ? Math.round((completed / total) * 100) : 0

  return (
    <div>
      <div className="grid grid-cols-[repeat(53,1fr)] gap-[2px]">
        {cellsArr.map(({ day, status }) => {
          const cls = `aspect-square rounded-sm ${status ? STATUS_COLOR[status] : 'bg-slate-100'}`
          const title = `${day}${status ? ` · ${status}` : ''}`
          if (!status) {
            return <div key={day} title={title} className={cls} />
          }
          // 회차 있는 날은 그 달 뷰의 해당 날짜로 이동
          const ym = day.slice(0, 7)
          return (
            <Link
              key={day}
              href={`${basePath}?view=month&ym=${ym}&day=${day}`}
              title={title}
              className={`${cls} transition hover:ring-2 hover:ring-indigo-400`}
            />
          )
        })}
      </div>
      <div className="mt-3 text-xs text-slate-500 text-center">
        {year}년 — 총 {total}회차 · 완료 {completed}회차 ({rate}%)
      </div>
    </div>
  )
}
