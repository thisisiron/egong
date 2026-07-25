'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { classBelongsToAcademy } from '@/lib/classes/service'
import { dispatchMaterialNotifications } from '@/lib/notifications/service'
import {
  createMaterialSchema,
  updateMaterialSchema,
  materialIdSchema,
} from './schemas'

function revalidateMaterials() {
  revalidatePath('/owner/materials')
  revalidatePath('/teacher/materials')
  revalidatePath('/me/materials')
}

/** files는 폼에서 JSON 문자열로 온다 — 파싱 실패는 빈 배열로 두고 zod가 거른다. */
function parseFilesField(raw: FormDataEntryValue | null): unknown {
  if (typeof raw !== 'string' || raw.trim() === '') return []
  try {
    return JSON.parse(raw)
  } catch {
    return []
  }
}

/** 타겟 자료가 내 학원 것인지 재검증 (RLS 위 2차 방어선). 통과 시 row 반환. */
async function verifyMaterialInMyAcademy(id: string): Promise<{ academy_id: string; files: unknown }> {
  const user = await requireRole(['owner', 'teacher'])
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('materials').select('academy_id, files').eq('id', id).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data || data.academy_id !== user.academyId) throw new Error('권한이 없습니다.')
  return data
}

export async function createMaterialAction(formData: FormData) {
  const user = await requireRole(['owner', 'teacher'])
  if (!user.academyId) throw new Error('소속 학원 정보가 없습니다.')

  const parsed = createMaterialSchema.parse({
    class_id: formData.get('class_id') ?? '',
    title: formData.get('title'),
    description: formData.get('description'),
    files: parseFilesField(formData.get('files')),
    notify_roles: formData.getAll('notify_roles'),
  })

  const supabase = await createClient()

  // 반 지정 시 내 학원 반인지 재검증 (RLS 위 2차 방어선) — 소유 도메인 service 경유
  if (parsed.class_id && !(await classBelongsToAcademy(parsed.class_id, user.academyId))) {
    throw new Error('잘못된 반입니다.')
  }

  const { data: inserted, error } = await supabase
    .from('materials')
    .insert({
      academy_id: user.academyId,
      class_id: parsed.class_id,
      title: parsed.title,
      description: parsed.description,
      files: parsed.files,
      created_by: user.id,
      author_name: user.displayName,
    })
    .select('id')
    .single()
  if (error) throw new Error(error.message)

  // 알림 fail-soft — 자료는 이미 저장됨. 실패해도 롤백하지 않고 로깅만.
  // (notifications 도메인 service 경유 — supabase.rpc는 reject하지 않고 {error}로 resolve하므로
  //  inline 호출 시 try/catch가 죽은 코드가 된다. service가 error를 throw로 변환해줘야 catch가 잡는다.)
  if (parsed.notify_roles.length > 0) {
    try {
      await dispatchMaterialNotifications(inserted.id, parsed.notify_roles)
    } catch (e) {
      console.error('자료 알림 발송 실패:', e)
    }
  }
  revalidateMaterials()
}

export async function updateMaterialAction(formData: FormData) {
  const parsed = updateMaterialSchema.parse({
    id: formData.get('id'),
    title: formData.get('title'),
    description: formData.get('description'),
  })
  await verifyMaterialInMyAcademy(parsed.id)

  const supabase = await createClient()
  const { error } = await supabase
    .from('materials')
    .update({ title: parsed.title, description: parsed.description })
    .eq('id', parsed.id)
  if (error) throw new Error(error.message)
  revalidateMaterials()
}

/** 삭제 — row 먼저, 그다음 스토리지 정리(best-effort).
 *  역순이면 정리 성공 후 row 삭제 실패 시 "파일 없는 자료"가 남는다.
 *  이 순서의 최악은 고아 파일(비가시·무해).
 */
export async function deleteMaterialAction(formData: FormData) {
  const id = materialIdSchema.parse(formData.get('id'))
  const target = await verifyMaterialInMyAcademy(id)

  const paths = Array.isArray(target.files)
    ? (target.files as Array<{ path?: unknown }>)
        .map((f) => (typeof f?.path === 'string' ? f.path : null))
        .filter((p): p is string => !!p)
    : []

  const supabase = await createClient()
  // 실제 삭제된 경우에만 스토리지 정리 — RLS가 막으면 0행이라 남의 파일을 건드리지 않는다.
  const { data: deleted, error } = await supabase
    .from('materials').delete().eq('id', id).select('id')
  if (error) throw new Error(error.message)

  if (deleted && deleted.length > 0 && paths.length > 0) {
    try {
      await supabase.storage.from('material-files').remove(paths)
    } catch (e) {
      console.error('자료 첨부 파일 삭제 실패:', e)
    }
  }
  revalidateMaterials()
}
