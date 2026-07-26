import 'server-only'

import { createClient } from '@/lib/supabase/server'
import type { Notification, NotifyRole } from './types'

const COLUMNS =
  'id, user_id, academy_id, type, title, link, source_id, read_at, created_at'

/** 내 안읽음 알림 개수 (벨 뱃지용). RLS가 본인 것만 반환. */
export async function getUnreadCount(): Promise<number> {
  const supabase = await createClient()
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null)
  if (error) throw new Error(error.message)
  return count ?? 0
}

/** 내 최근 알림 목록 (최신순). RLS가 본인 것만 반환. */
export async function listMyNotifications(limit = 20): Promise<Notification[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('notifications')
    .select(COLUMNS)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return data ?? []
}

/** 공지 fan-out — definer RPC가 (역할 ∩ 범위) 수신자에게 알림 생성. 생성 행 수 반환. */
export async function dispatchAnnouncementNotifications(
  announcementId: string,
  roles: NotifyRole[]
): Promise<number> {
  if (roles.length === 0) return 0
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('create_announcement_notifications', {
    p_announcement_id: announcementId,
    p_roles: roles,
  })
  if (error) throw new Error(error.message)
  return data ?? 0
}

/** 자료 fan-out — definer RPC가 (역할 ∩ 범위) 수신자에게 알림 생성. 생성 행 수 반환. */
export async function dispatchMaterialNotifications(
  materialId: string,
  roles: NotifyRole[]
): Promise<number> {
  if (roles.length === 0) return 0
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('create_material_notifications', {
    p_material_id: materialId,
    p_roles: roles,
  })
  if (error) throw new Error(error.message)
  return data ?? 0
}

/** 성적 공개 fan-out — definer RPC가 (역할 ∩ 범위) 수신자에게 알림 생성. 생성 행 수 반환. */
export async function dispatchExamNotifications(
  examId: string,
  roles: NotifyRole[]
): Promise<number> {
  if (roles.length === 0) return 0
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('create_exam_notifications', {
    p_exam_id: examId,
    p_roles: roles,
  })
  if (error) throw new Error(error.message)
  return data ?? 0
}
