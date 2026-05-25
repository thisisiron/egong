import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from './lib/supabase/database.types'

const PUBLIC_PATHS = ['/login', '/forgot-password', '/auth']

const ROLE_PREFIX: Record<string, string[]> = {
  admin: ['/admin'],
  owner: ['/owner'],
  teacher: ['/teacher'],
  student: ['/me'],
  parent: ['/me'],
}

function roleHome(role: string): string {
  if (role === 'admin') return '/admin'
  if (role === 'owner') return '/owner'
  if (role === 'teacher') return '/teacher'
  return '/me'
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname

  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return response
  }

  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile) {
    // 로그인은 됐지만 users 행 없음 → 강제 로그아웃
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('error', 'no_profile')
    return NextResponse.redirect(url)
  }

  if (pathname === '/' || pathname === '') {
    const url = request.nextUrl.clone()
    url.pathname = roleHome(profile.role)
    return NextResponse.redirect(url)
  }

  const allowedPrefixes = ROLE_PREFIX[profile.role] ?? []
  const matchesAllowed = allowedPrefixes.some(p => pathname.startsWith(p))
  if (!matchesAllowed) {
    const url = request.nextUrl.clone()
    url.pathname = roleHome(profile.role)
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
}
