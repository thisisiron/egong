'use server'
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
