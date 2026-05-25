import { apiFetch } from '@/lib/api/client'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const origin = new URL(request.url).origin

  const result = await apiFetch<{ owner_email: string; magic_link: string }>(
    '/admin/impersonate',
    {
      method: 'POST',
      body: JSON.stringify({ academy_id: id }),
      headers: { Origin: origin },
    }
  )

  const response = NextResponse.redirect(result.magic_link, { status: 303 })
  // Set impersonation flag cookie so ImpersonationBanner shows after magic-link login
  response.cookies.set('impersonated', '1', {
    httpOnly: false,
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 60, // 30 min
  })
  return response
}
