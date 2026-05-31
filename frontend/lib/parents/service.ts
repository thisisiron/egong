import 'server-only'

import { apiFetch } from '@/lib/api/client'
import { createClient } from '@/lib/supabase/server'
import type { ParentRow } from './types'

function pickOne<T>(v: T | T[] | null | undefined): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null)
}

/** 학부모 목록 + 연결된 학생 수. RLS가 owner 학원 범위로 제한. */
export async function listParents(): Promise<ParentRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('parents')
    .select('id, name, phone, users(email), student_parent(student_id)')
    .order('name')
  if (error) throw new Error(error.message)
  return (data ?? []).map(
    (p: {
      id: string
      name: string
      phone: string | null
      users: unknown
      student_parent: unknown[] | null
    }) => {
      const u = pickOne(p.users) as { email: string | null } | null
      return {
        id: p.id,
        name: p.name,
        email: u?.email ?? null,
        phone: p.phone,
        linked_student_count: Array.isArray(p.student_parent)
          ? p.student_parent.length
          : 0,
      }
    }
  )
}

/** 학부모 이메일 → parent.id 해석 (backend service-role 조회). 미발견 시 null. */
export async function resolveParentIdByEmail(
  email: string
): Promise<string | null> {
  try {
    const result = await apiFetch<{ id: string }>(
      `/owner/parents/by-email?email=${encodeURIComponent(email)}`
    )
    return result.id
  } catch {
    return null
  }
}
