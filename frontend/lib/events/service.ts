import 'server-only'

import { createClient } from '@/lib/supabase/server'
import type { ScheduleEventWithClass } from './types'

const COLUMNS = 'id, academy_id, class_id, type, title, event_date, memo, author_name'

type JoinedRow = {
  id: string
  academy_id: string
  class_id: string | null
  type: 'exam' | 'consultation'
  title: string
  event_date: string
  memo: string | null
  author_name: string
  classes: { name: string } | { name: string }[] | null
}

function withClassName(row: JoinedRow): ScheduleEventWithClass {
  const cls = Array.isArray(row.classes) ? row.classes[0] : row.classes
  return {
    id: row.id,
    academy_id: row.academy_id,
    class_id: row.class_id,
    type: row.type,
    title: row.title,
    event_date: row.event_date,
    memo: row.memo,
    author_name: row.author_name,
    class_name: cls?.name ?? null,
  }
}

/** 기간 내 이벤트 (event_date 'YYYY-MM-DD' 경계 양끝 포함). RLS가 역할별 범위 적용. */
export async function getEventsInRange(
  fromDate: string,
  toDate: string
): Promise<ScheduleEventWithClass[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('schedule_events')
    .select(`${COLUMNS}, classes(name)`)
    .gte('event_date', fromDate)
    .lte('event_date', toDate)
    .order('event_date')
  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => withClassName(r as JoinedRow))
}
