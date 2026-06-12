'use client'

import { useState } from 'react'
import { LogOut, PanelLeftClose, PanelLeftOpen } from 'lucide-react'

import { Logo } from '@/components/Logo'
import { cn } from '@/lib/utils'
import type { UserRole } from '@/lib/auth'
import { NavList } from './NavList'
import { ROLE_LABEL, type NavKey } from './nav-config'

type Props = {
  navKey: NavKey
  role: UserRole
  displayName: string
  academyName: string | null
  initialCollapsed: boolean
}

const COOKIE = 'sidebar_collapsed'

export function Sidebar({ navKey, role, displayName, academyName, initialCollapsed }: Props) {
  const [collapsed, setCollapsed] = useState(initialCollapsed)

  function toggle() {
    const next = !collapsed
    setCollapsed(next)
    // SSR 첫 렌더가 같은 상태로 나오도록 쿠키에 저장 (깜빡임 방지)
    document.cookie = `${COOKIE}=${next ? '1' : '0'}; path=/; max-age=31536000; samesite=lax`
  }

  return (
    <aside
      className={cn(
        'sticky top-0 hidden h-screen shrink-0 flex-col border-r border-gray-200 bg-white transition-[width] duration-200 lg:flex',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      <div className={cn('flex items-center gap-2 px-3 py-4', collapsed && 'justify-center px-2')}>
        {collapsed ? (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-base">
            🥚
          </span>
        ) : (
          <Logo subtitle={academyName ?? ROLE_LABEL[role]} />
        )}
      </div>

      <NavList navKey={navKey} collapsed={collapsed} />

      <div className="border-t border-gray-200 p-3">
        <div className={cn('flex items-center gap-2', collapsed && 'flex-col')}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700">
            {displayName.charAt(0)}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-slate-900">{displayName}</div>
              <div className="text-xs text-slate-500">{ROLE_LABEL[role]}</div>
            </div>
          )}
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
        <button
          onClick={toggle}
          aria-label={collapsed ? '사이드바 펼치기' : '사이드바 접기'}
          className={cn(
            'mt-2 flex w-full items-center justify-center gap-2 rounded-md py-1.5 text-xs text-slate-400 hover:bg-gray-100 hover:text-slate-700'
          )}
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          {!collapsed && '접기'}
        </button>
      </div>
    </aside>
  )
}
