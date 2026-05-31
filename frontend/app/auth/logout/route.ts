// 세션 인증 인프라 — Supabase auth 클라이언트(signOut)를 직접 써야 함.
// 도메인 데이터 접근이 아니므로 DAL 규칙의 정당한 예외.
// eslint-disable-next-line no-restricted-imports
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  await supabase.auth.signOut()
  const response = NextResponse.redirect(new URL('/login', request.url), { status: 303 })
  // Clear impersonation flag cookie if set (no-op otherwise)
  response.cookies.set('impersonated', '', { path: '/', maxAge: 0 })
  return response
}
