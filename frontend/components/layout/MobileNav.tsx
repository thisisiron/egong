'use client'

import { startTransition, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { LogOut, Menu, X } from 'lucide-react'

import { Logo } from '@/components/Logo'
import type { UserRole } from '@/lib/auth'
import { NavList } from './NavList'
import { ROLE_LABEL, type NavKey } from './nav-config'

type Props = {
  navKey: NavKey
  role: UserRole
  displayName: string
  academyName: string | null
}

export function MobileNav({ navKey, role, displayName, academyName }: Props) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  // 라우트가 바뀌면 드로어 닫기
  useEffect(() => {
    startTransition(() => setOpen(false))
  }, [pathname])

  return (
    <div className="sticky top-0 z-40 border-b border-gray-200 bg-white lg:hidden">
      <div className="flex items-center gap-2 px-4 py-3">
        <button
          onClick={() => setOpen(true)}
          aria-label="메뉴 열기"
          className="rounded-md p-1.5 text-slate-600 hover:bg-gray-100"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Logo subtitle={academyName ?? ROLE_LABEL[role]} />
      </div>

      {open && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="메뉴">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between px-4 py-4">
              <Logo subtitle={academyName ?? ROLE_LABEL[role]} />
              <button
                onClick={() => setOpen(false)}
                aria-label="메뉴 닫기"
                className="rounded-md p-1.5 text-slate-500 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <NavList navKey={navKey} onNavigate={() => setOpen(false)} />
            <div className="flex items-center gap-2 border-t border-gray-200 p-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700">
                {displayName.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-slate-900">{displayName}</div>
                <div className="text-xs text-slate-500">{ROLE_LABEL[role]}</div>
              </div>
              <form action="/auth/logout" method="post">
                <button
                  title="로그아웃"
                  aria-label="로그아웃"
                  className="rounded-md p-1.5 text-slate-400 hover:bg-gray-100 hover:text-slate-700"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
