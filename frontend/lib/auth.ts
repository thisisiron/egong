import { cache } from 'react'
import { createClient } from './supabase/server'
import { redirect } from 'next/navigation'
import type { Database } from './supabase/database.types'

export type UserRole = Database['public']['Enums']['user_role']

export type SessionUser = {
  id: string
  email: string | null
  role: UserRole
  academyId: string | null
  displayName: string
}

export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('users')
    .select('role, academy_id, display_name')
    .eq('id', user.id)
    .single()

  if (!profile) return null

  return {
    id: user.id,
    email: user.email ?? null,
    role: profile.role,
    academyId: profile.academy_id,
    displayName: profile.display_name,
  }
})

export async function requireRole(allowed: UserRole[]): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  if (!allowed.includes(user.role)) redirect(roleHome(user.role))
  return user
}

export function roleHome(role: UserRole): string {
  switch (role) {
    case 'admin': return '/admin'
    case 'owner': return '/owner'
    case 'teacher': return '/teacher'
    case 'student':
    case 'parent': return '/me'
  }
}
