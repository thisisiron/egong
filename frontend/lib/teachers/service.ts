import 'server-only'

import { createClient } from '@/lib/supabase/server'
import type { TeacherRow } from './types'

function pickOne<T>(v: T | T[] | null | undefined): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null)
}

/** 선생님 목록. RLS가 학원 범위 필터. */
export async function listTeachers(): Promise<TeacherRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('teachers')
    .select('id, users(display_name, phone, email)')
    .order('id')
  if (error) throw new Error(error.message)
  return (data ?? []).map((t: { id: string; users: unknown }) => {
    const u = pickOne(t.users) as
      | { display_name: string; phone: string | null; email: string | null }
      | null
    return {
      id: t.id,
      display_name: u?.display_name ?? '-',
      email: u?.email ?? null,
      phone: u?.phone ?? null,
    }
  })
}

/** 선생님 수 (RLS가 학원 범위). */
export async function countTeachers(): Promise<number> {
  const supabase = await createClient()
  const { count, error } = await supabase
    .from('teachers')
    .select('*', { count: 'exact', head: true })
  if (error) throw new Error(error.message)
  return count ?? 0
}
