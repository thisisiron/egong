import 'server-only'

import { createClient } from '@/lib/supabase/server'
import type { Material, MaterialFile, MaterialWithClass, SignedMaterialFile } from './types'

const COLS =
  'id, academy_id, class_id, title, description, files, created_by, author_name, created_at'

type JoinedRow = Omit<Material, 'files'> & {
  files: unknown
  classes: { name: string } | { name: string }[] | null
}

/** jsonb → MaterialFile[] (형식 불량은 조용히 무시 — 표시가 목적). */
function toFiles(raw: unknown): MaterialFile[] {
  if (!Array.isArray(raw)) return []
  return raw.filter(
    (f): f is MaterialFile =>
      !!f && typeof f === 'object' &&
      typeof (f as MaterialFile).path === 'string' &&
      typeof (f as MaterialFile).name === 'string'
  )
}

function withClassName(row: JoinedRow): MaterialWithClass {
  const { classes, files, ...rest } = row
  const cls = Array.isArray(classes) ? classes[0] : classes
  return { ...rest, files: toFiles(files), class_name: cls?.name ?? null }
}

/** 스태프(owner·teacher) — RLS가 학원 범위 적용. 최신순. */
export async function listMaterials(): Promise<MaterialWithClass[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('materials')
    .select(`${COLS}, classes(name)`)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => withClassName(r as JoinedRow))
}

/** 학생/학부모 — 학원 전체 자료 + 해당 학생의 현재 반 자료. 최신순. */
export async function listMaterialsForStudent(studentId: string): Promise<MaterialWithClass[]> {
  const supabase = await createClient()

  const { data: stu, error: stuErr } = await supabase
    .from('students').select('academy_id').eq('id', studentId).maybeSingle()
  if (stuErr) throw new Error(stuErr.message)
  if (!stu) return []

  const { data: cs, error: csErr } = await supabase
    .from('class_students').select('class_id').eq('student_id', studentId).is('left_at', null)
  if (csErr) throw new Error(csErr.message)
  const classIds = (cs ?? []).map((r) => r.class_id)

  let query = supabase
    .from('materials')
    .select(`${COLS}, classes(name)`)
    .order('created_at', { ascending: false })
  query =
    classIds.length > 0
      ? query.or(
          `and(class_id.is.null,academy_id.eq.${stu.academy_id}),class_id.in.(${classIds.join(',')})`
        )
      : query.is('class_id', null).eq('academy_id', stu.academy_id)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => withClassName(r as JoinedRow))
}

export async function getMaterial(id: string): Promise<MaterialWithClass | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('materials').select(`${COLS}, classes(name)`).eq('id', id).maybeSingle()
  if (error) throw new Error(error.message)
  return data ? withClassName(data as JoinedRow) : null
}

/** 여러 자료의 첨부를 한 번에 서명 → materialId별 SignedMaterialFile[] (N+1 방지).
 *  RSC→클라이언트 직렬화를 위해 Map이 아닌 Record 반환.
 */
export async function signMaterialFilesByMaterial(
  items: Array<{ id: string; files: MaterialFile[] }>
): Promise<Record<string, SignedMaterialFile[]>> {
  const flat = items.flatMap((m) => m.files.map((f) => ({ materialId: m.id, file: f })))
  if (flat.length === 0) return {}

  const supabase = await createClient()
  const { data, error } = await supabase.storage
    .from('material-files')
    .createSignedUrls(flat.map((x) => x.file.path), 60 * 10)
  if (error) throw new Error(error.message)

  const urlByPath = new Map<string, string | null>()
  for (const d of data ?? []) urlByPath.set(d.path ?? '', d.signedUrl ?? null)

  const out: Record<string, SignedMaterialFile[]> = {}
  for (const { materialId, file } of flat) {
    ;(out[materialId] ??= []).push({ ...file, url: urlByPath.get(file.path) ?? null })
  }
  return out
}
