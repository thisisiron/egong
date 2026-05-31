'use server'
// 세션 인증 인프라 — Supabase auth 클라이언트(signInWithPassword)를 직접 써야 함.
// 도메인 데이터 접근이 아니므로 DAL 규칙의 정당한 예외.
// eslint-disable-next-line no-restricted-imports
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { roleHome } from '@/lib/auth'

export async function loginAction(formData: FormData) {
  const email = String(formData.get('email') ?? '')
  const password = String(formData.get('password') ?? '')
  const next = String(formData.get('next') ?? '')

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`)
  }

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', data.user.id)
    .single()

  if (!profile) {
    redirect('/login?error=no_profile')
  }

  redirect(next || roleHome(profile.role))
}
