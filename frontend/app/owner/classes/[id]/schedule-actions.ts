'use server'

import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

type GenerateInput = {
  class_id: string
  from_date: string
  to_date: string
  time_of_day: string // HH:MM
  title_prefix: string
  weekdays: number[] // 0=Sun..6=Sat
}

export async function generateSessionsAction(input: GenerateInput) {
  await requireRole(['owner'])
  const supabase = await createClient()

  const [hh, mm] = input.time_of_day.split(':').map(Number)
  const from = new Date(input.from_date + 'T00:00:00')
  const to = new Date(input.to_date + 'T00:00:00')
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new Error('잘못된 날짜 형식입니다.')
  }
  if (from > to) throw new Error('시작일이 종료일보다 늦습니다.')
  if (input.weekdays.length === 0) throw new Error('요일을 선택해주세요.')

  const sessions: { class_id: string; scheduled_at: string; title: string }[] = []
  const cursor = new Date(from)
  while (cursor <= to) {
    if (input.weekdays.includes(cursor.getDay())) {
      const scheduled = new Date(cursor)
      scheduled.setHours(hh, mm, 0, 0)
      const dateLabel = `${scheduled.getMonth() + 1}/${scheduled.getDate()}`
      sessions.push({
        class_id: input.class_id,
        scheduled_at: scheduled.toISOString(),
        title: `${dateLabel} ${input.title_prefix || '수업'}`,
      })
    }
    cursor.setDate(cursor.getDate() + 1)
  }

  if (sessions.length === 0) return { created: 0 }

  const { data, error } = await supabase
    .from('sessions')
    .insert(sessions)
    .select('id')
  if (error) throw new Error(error.message)
  revalidatePath(`/owner/classes/${input.class_id}`)
  return { created: data?.length ?? 0 }
}
