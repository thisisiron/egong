'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { cn } from '@/lib/utils'
import { NAV, activeHref, type NavKey } from './nav-config'

type Props = {
  navKey: NavKey
  collapsed?: boolean
  onNavigate?: () => void
}

export function NavList({ navKey, collapsed = false, onNavigate }: Props) {
  const pathname = usePathname()
  const sections = NAV[navKey]
  const active = activeHref(
    pathname,
    sections.flatMap((s) => s.items.map((i) => i.href))
  )

  return (
    <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
      {sections.map((section, si) => (
        <div key={section.label ?? si}>
          {section.label && !collapsed && (
            <div className="px-3 pb-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">
              {section.label}
            </div>
          )}
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const isActive = item.href === active
              const Icon = item.icon
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                      collapsed && 'justify-center px-2',
                      isActive
                        ? 'bg-indigo-50 font-medium text-indigo-700'
                        : 'text-slate-600 hover:bg-gray-100 hover:text-slate-900'
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}
