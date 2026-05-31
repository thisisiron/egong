export type RepeatFreq = 'daily' | 'weekly' | 'biweekly' | 'monthly'

export type RepeatConfig = {
  fromDate: string // 'YYYY-MM-DD'
  toDate: string // 'YYYY-MM-DD'
  time: string // 'HH:MM'
  freq: RepeatFreq
  weekdays: number[] // 0=Sun..6=Sat (weekly/biweekly)
  monthDays: number[] // 1..31 (monthly)
  titlePrefix: string
}

export type GeneratedSession = {
  scheduled_at: string // ISO (브라우저 TZ 기준)
  title: string
}

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000

/** 그 날이 속한 주의 월요일(00:00). */
function mondayOf(d: Date): Date {
  const r = new Date(d)
  r.setHours(0, 0, 0, 0)
  const back = (r.getDay() + 6) % 7 // getDay: Sun=0..Sat=6 → 월요일까지 일수
  r.setDate(r.getDate() - back)
  return r
}

/** 반복 설정 → 생성될 세션 목록. 순수 함수 (브라우저 TZ로 toISOString). */
export function buildRepeatSessions(cfg: RepeatConfig): GeneratedSession[] {
  const [hh, mm] = cfg.time.split(':').map(Number)
  const from = new Date(cfg.fromDate + 'T00:00:00')
  const to = new Date(cfg.toDate + 'T23:59:59')
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return []
  if (Number.isNaN(hh) || Number.isNaN(mm)) return []
  if (from > to) return []

  const dates: Date[] = []

  if (cfg.freq === 'daily') {
    const cursor = new Date(from)
    while (cursor <= to) {
      dates.push(new Date(cursor))
      cursor.setDate(cursor.getDate() + 1)
    }
  } else if (cfg.freq === 'weekly') {
    const cursor = new Date(from)
    while (cursor <= to) {
      if (cfg.weekdays.includes(cursor.getDay())) dates.push(new Date(cursor))
      cursor.setDate(cursor.getDate() + 1)
    }
  } else if (cfg.freq === 'biweekly') {
    const anchor = mondayOf(from)
    const cursor = new Date(from)
    while (cursor <= to) {
      if (cfg.weekdays.includes(cursor.getDay())) {
        const weekIdx = Math.round(
          (mondayOf(cursor).getTime() - anchor.getTime()) / MS_PER_WEEK
        )
        if (weekIdx % 2 === 0) dates.push(new Date(cursor))
      }
      cursor.setDate(cursor.getDate() + 1)
    }
  } else {
    // monthly
    let y = from.getFullYear()
    let m = from.getMonth()
    while (new Date(y, m, 1) <= to) {
      for (const md of cfg.monthDays) {
        const d = new Date(y, m, md)
        if (d.getMonth() !== m) continue // 그 달에 없는 날 (예: 2월 30일)
        d.setHours(0, 0, 0, 0)
        if (d >= from && d <= to) dates.push(d)
      }
      m += 1
      if (m > 11) {
        m = 0
        y += 1
      }
    }
    dates.sort((a, b) => a.getTime() - b.getTime())
  }

  const prefix = cfg.titlePrefix.trim() || '수업'
  return dates.map((d) => {
    const scheduled = new Date(d)
    scheduled.setHours(hh, mm, 0, 0)
    return {
      scheduled_at: scheduled.toISOString(),
      title: `${scheduled.getMonth() + 1}/${scheduled.getDate()} ${prefix}`,
    }
  })
}
