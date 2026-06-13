'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser } from '@/lib/auth'
import { notificationIdSchema } from './schemas'

/** 단건 읽음 처리 — 본인 것만(.eq user_id, RLS 위 2차 방어선). */
export async function markNotificationReadAction(id: string) {
  const user = await getSessionUser()
  if (!user) throw new Error('로그인이 필요합니다.')
  const notifId = notificationIdSchema.parse(id)

  const supabase = await createClient()
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notifId)
    .eq('user_id', user.id)
  if (error) throw new Error(error.message)
  // 레이아웃(벨)의 서버 렌더 카운트 갱신
  revalidatePath('/', 'layout')
}

/** 내 안읽음 전체 읽음 처리. */
export async function markAllReadAction() {
  const user = await getSessionUser()
  if (!user) throw new Error('로그인이 필요합니다.')

  const supabase = await createClient()
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .is('read_at', null)
  if (error) throw new Error(error.message)
  revalidatePath('/', 'layout')
}
