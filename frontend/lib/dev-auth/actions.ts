'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { roleHome, type UserRole } from '@/lib/auth'
import { lookupDevAccount } from './constants'
import { isDevLoginEnabled } from './guard'

const SEED_HINT =
  '시드 계정이 없거나 비밀번호가 다릅니다. seed_dev_accounts.py --reset-passwords 를 실행하세요'

export async function devLoginAction(role: UserRole) {
  if (!isDevLoginEnabled()) throw new Error('dev login disabled')

  const account = lookupDevAccount(role)
  if (!account) throw new Error(`unknown dev role: ${role}`)

  // 하드코딩 기본값 없음 — 시드 비밀번호가 공개 저장소에 평문으로 남지 않게 한다.
  const password = process.env.DEV_LOGIN_PASSWORD
  if (!password) {
    throw new Error(
      'DEV_LOGIN_PASSWORD 환경변수가 설정되지 않았습니다 (.env.local 확인)'
    )
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({
    email: account.email,
    password,
  })

  if (error) {
    redirect(`/login?error=${encodeURIComponent(SEED_HINT)}`)
  }

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', data.user.id)
    .single()

  if (!profile) {
    redirect('/login?error=no_profile')
  }

  redirect(roleHome(profile.role))
}
