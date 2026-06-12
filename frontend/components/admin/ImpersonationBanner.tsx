'use client'

import { useSyncExternalStore } from 'react'
import { useSearchParams } from 'next/navigation'

function subscribeCookie(callback: () => void) {
  // document.cookie has no change event; the banner only needs to read
  // it once on mount (cookies are set server-side before this page renders).
  // No-op subscribe is safe because the cookie value won't change during
  // a single page lifecycle.
  if (typeof window === 'undefined') return () => {}
  window.addEventListener('focus', callback)
  return () => window.removeEventListener('focus', callback)
}

function getCookieSnapshot() {
  return document.cookie.includes('impersonated=1') ? '1' : '0'
}

function getServerCookieSnapshot() {
  return '0'
}

export function ImpersonationBanner() {
  const params = useSearchParams()
  const cookieFlag = useSyncExternalStore(
    subscribeCookie,
    getCookieSnapshot,
    getServerCookieSnapshot
  )

  const isImpersonating = params.get('impersonated') === '1' || cookieFlag === '1'
  if (!isImpersonating) return null

  return (
    <div className="bg-red-600 text-white text-center text-sm py-2">
      ⚠ Admin Impersonation 모드 —{' '}
      <form action="/auth/logout" method="post" className="inline">
        <button type="submit" className="underline ml-2">
          종료
        </button>
      </form>
    </div>
  )
}
