'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { classBelongsToAcademy } from '@/lib/classes/service'
import { getMyTeachingClasses } from '@/lib/sessions/service'
import { createEventSchema, updateEventSchema, eventIdSchema } from './schemas'
import type { CreateEventInput, UpdateEventInput } from './schemas'

function revalidateSchedule() {
  revalidatePath('/owner/schedule')
  revalidatePath('/teacher')
  revalidatePath('/me')
}

/** class_id(또는 NULL=전체)에 대한 작성 권한 재검증.
 * - owner: class_id NULL(전체) 허용 또는 학원 일치
 * - teacher: 전체 이벤트 불가, 담당 반만
 */
async function verifyEventWriteAccess(
  classId: string | null,
  academyId: string,
  role: 'owner' | 'teacher'
): Promise<void> {
  if (role === 'teacher') {
    if (!classId) throw new Error('선생님은 학원 전체 이벤트를 만들 수 없습니다. 반을 선택해주세요.')
    const mine = await getMyTeachingClasses()
    if (!mine.some((c) => c.id === classId)) throw new Error('권한이 없습니다.')
    return
  }
  // owner
  if (classId && !(await classBelongsToAcademy(classId, academyId))) {
    throw new Error('권한이 없습니다.')
  }
}

export async function createEventAction(input: CreateEventInput) {
  const user = await requireRole(['owner', 'teacher'])
  if (!user.academyId) throw new Error('소속 학원 정보가 없습니다.')
  const parsed = createEventSchema.parse(input)
  await verifyEventWriteAccess(parsed.class_id, user.academyId, user.role as 'owner' | 'teacher')

  const supabase = await createClient()
  const { error } = await supabase.from('schedule_events').insert({
    academy_id: user.academyId,
    class_id: parsed.class_id,
    type: parsed.type,
    title: parsed.title,
    event_date: parsed.event_date,
    memo: parsed.memo,
    created_by: user.id,
    author_name: user.displayName,
  })
  if (error) throw new Error(error.message)
  revalidateSchedule()
}

/** 타겟 이벤트 소유권 확인 — owner: 학원 일치, teacher: 본인 작성. 통과 시 row 반환. */
async function verifyEventOwnership(
  id: string
): Promise<{ academy_id: string; created_by: string | null }> {
  const user = await requireRole(['owner', 'teacher'])
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('schedule_events')
    .select('academy_id, created_by')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  const allowed =
    !!data &&
    (user.role === 'owner' ? data.academy_id === user.academyId : data.created_by === user.id)
  if (!allowed || !data) throw new Error('권한이 없습니다.')
  return data
}

export async function updateEventAction(input: UpdateEventInput) {
  const user = await requireRole(['owner', 'teacher'])
  if (!user.academyId) throw new Error('소속 학원 정보가 없습니다.')
  const parsed = updateEventSchema.parse(input)
  await verifyEventOwnership(parsed.id)
  await verifyEventWriteAccess(parsed.class_id, user.academyId, user.role as 'owner' | 'teacher')

  const supabase = await createClient()
  const { error } = await supabase
    .from('schedule_events')
    .update({
      type: parsed.type,
      title: parsed.title,
      event_date: parsed.event_date,
      class_id: parsed.class_id,
      memo: parsed.memo,
      updated_at: new Date().toISOString(),
    })
    .eq('id', parsed.id)
  if (error) throw new Error(error.message)
  revalidateSchedule()
}

export async function deleteEventAction(input: { id: string }) {
  const id = eventIdSchema.parse(input.id)
  await verifyEventOwnership(id)
  const supabase = await createClient()
  const { error } = await supabase.from('schedule_events').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidateSchedule()
}
