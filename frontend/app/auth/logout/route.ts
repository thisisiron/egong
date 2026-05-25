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
