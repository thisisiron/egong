'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireRole, getSessionUser } from '@/lib/auth'
import {
  sessionCreateSchema,
  sessionUpdateSchema,
  sessionDeleteSchema,
} from './schemas'
import type {
  SessionCreateInput,
  SessionUpdateInput,
  SessionDeleteInput,
} from './schemas'

/** owner 또는 teacher만 가능. 추가 권한 검증은 verifyClassAccess가 담당. */
async function requireOwnerOrTeacher() {
  return requireRole(['owner', 'teacher'])
}

/** 현재 사용자가 해당 class_id에 권한이 있는지 검증.
 * - owner: classes.academy_id === user.academyId
 * - teacher: class_teachers 에 (class_id, my teacher_id) 존재
 *
 * 권한 없음이면 throw new Error('권한이 없습니다.')
 */
async function verifyClassAccess(classId: string): Promise<void> {
  const user = await getSessionUser()
  if (!user) throw new Error('로그인이 필요합니다.')
  const supabase = await createClient()

  if (user.role === 'owner') {
    const { data, error } = await supabase
      .from('classes')
      .select('academy_id')
      .eq('id', classId)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!data || data.academy_id !== user.academyId) {
      throw new Error('권한이 없습니다.')
    }
    return
  }

  if (user.role === 'teacher') {
    // class_teachers join teachers — teachers.user_id === auth.uid()
    const { data, error } = await supabase
      .from('class_teachers')
      .select('class_id, teachers!inner(user_id)')
      .eq('class_id', classId)
      .eq('teachers.user_id', user.id)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) throw new Error('권한이 없습니다.')
    return
  }

  throw new Error('권한이 없습니다.')
}

/** revalidate 대상 페이지들. owner 페이지·teacher 페이지 둘 다 안전하게 갱신. */
function revalidateAll(classId: string) {
  revalidatePath(`/owner/classes/${classId}`)
  revalidatePath('/teacher')
}

export async function createSessionAction(input: SessionCreateInput) {
  await requireOwnerOrTeacher()
  const parsed = sessionCreateSchema.parse(input)
  await verifyClassAccess(parsed.class_id)

  const supabase = await createClient()
  // datetime-local 'YYYY-MM-DDTHH:mm' 은 로컬 시각 → UTC ISO 변환
  const isoScheduledAt = new Date(parsed.scheduled_at).toISOString()

  const { error } = await supabase.from('sessions').insert({
    class_id: parsed.class_id,
    title: parsed.title,
    scheduled_at: isoScheduledAt,
    unit: parsed.unit,
  })
  if (error) throw new Error(error.message)

  revalidateAll(parsed.class_id)
}

export async function updateSessionAction(input: SessionUpdateInput) {
  await requireOwnerOrTeacher()
  const parsed = sessionUpdateSchema.parse(input)

  // 권한 검증: 해당 세션의 class_id로 검증
  const supabase = await createClient()
  const { data: existing, error: lookupErr } = await supabase
    .from('sessions')
    .select('class_id')
    .eq('id', parsed.id)
    .maybeSingle()
  if (lookupErr) throw new Error(lookupErr.message)
  if (!existing) throw new Error('세션을 찾을 수 없습니다.')
  await verifyClassAccess(existing.class_id)

  const isoScheduledAt = new Date(parsed.scheduled_at).toISOString()

  const { error } = await supabase
    .from('sessions')
    .update({
      title: parsed.title,
      scheduled_at: isoScheduledAt,
      unit: parsed.unit,
      video_url: parsed.video_url,
      video_notes: parsed.video_notes,
    })
    .eq('id', parsed.id)
  if (error) throw new Error(error.message)

  revalidateAll(existing.class_id)
}

export async function deleteSessionAction(input: SessionDeleteInput) {
  await requireOwnerOrTeacher()
  const parsed = sessionDeleteSchema.parse(input)

  const supabase = await createClient()
  const { data: existing, error: lookupErr } = await supabase
    .from('sessions')
    .select('class_id')
    .eq('id', parsed.id)
    .maybeSingle()
  if (lookupErr) throw new Error(lookupErr.message)
  if (!existing) throw new Error('세션을 찾을 수 없습니다.')
  await verifyClassAccess(existing.class_id)

  // attendance row는 ON DELETE CASCADE 로 자동 삭제됨.
  const { error } = await supabase.from('sessions').delete().eq('id', parsed.id)
  if (error) throw new Error(error.message)

  revalidateAll(existing.class_id)
}
