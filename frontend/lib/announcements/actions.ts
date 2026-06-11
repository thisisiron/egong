'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { classBelongsToAcademy } from '@/lib/classes/service'
import { getMyTeachingClasses } from '@/lib/sessions/service'
import { createAnnouncementSchema, updateAnnouncementSchema } from './schemas'

/** 공지가 노출되는 경로 일괄 재검증. */
function revalidateAnnouncements() {
  revalidatePath('/owner/announcements')
  revalidatePath('/teacher/announcements')
  revalidatePath('/me')
}

export async function createAnnouncementAction(formData: FormData) {
  const user = await requireRole(['owner', 'teacher'])
  if (!user.academyId) throw new Error('소속 학원 정보가 없습니다.')

  const parsed = createAnnouncementSchema.parse({
    title: formData.get('title'),
    body: formData.get('body'),
    class_id: formData.get('class_id') ?? '',
  })

  // 소유권 재검증 (RLS 위 2차 방어선)
  if (user.role === 'teacher') {
    if (!parsed.class_id) throw new Error('반을 선택해주세요.')
    const mine = await getMyTeachingClasses()
    if (!mine.some((c) => c.id === parsed.class_id)) {
      throw new Error('권한이 없습니다.')
    }
  } else if (parsed.class_id) {
    if (!(await classBelongsToAcademy(parsed.class_id, user.academyId))) {
      throw new Error('권한이 없습니다.')
    }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('announcements').insert({
    academy_id: user.academyId,
    class_id: parsed.class_id,
    title: parsed.title,
    body: parsed.body,
    created_by: user.id,
    author_name: user.displayName,
  })
  if (error) throw new Error(error.message)
  revalidateAnnouncements()
}

/** 타겟 공지 소유권 확인 — owner: 학원 일치, teacher: 본인 작성. 아니면 throw. */
async function verifyAnnouncementOwnership(id: string): Promise<void> {
  const user = await requireRole(['owner', 'teacher'])
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('announcements')
    .select('academy_id, created_by')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  const allowed =
    !!data &&
    (user.role === 'owner'
      ? data.academy_id === user.academyId
      : data.created_by === user.id)
  if (!allowed) throw new Error('권한이 없습니다.')
}

export async function updateAnnouncementAction(formData: FormData) {
  const parsed = updateAnnouncementSchema.parse({
    id: formData.get('id'),
    title: formData.get('title'),
    body: formData.get('body'),
  })
  await verifyAnnouncementOwnership(parsed.id)

  const supabase = await createClient()
  const { error } = await supabase
    .from('announcements')
    .update({
      title: parsed.title,
      body: parsed.body,
      updated_at: new Date().toISOString(),
    })
    .eq('id', parsed.id)
  if (error) throw new Error(error.message)
  revalidateAnnouncements()
}

export async function deleteAnnouncementAction(formData: FormData) {
  const id = String(formData.get('id'))
  await verifyAnnouncementOwnership(id)

  const supabase = await createClient()
  const { error } = await supabase.from('announcements').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidateAnnouncements()
}
