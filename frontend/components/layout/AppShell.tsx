import { cookies } from 'next/headers'

import type { SessionUser } from '@/lib/auth'
import { MobileNav } from './MobileNav'
import { Sidebar } from './Sidebar'
import { navKeyForRole } from './nav-config'

type Props = {
  user: SessionUser
  academyName: string | null
  children: React.ReactNode
}

export async function AppShell({ user, academyName, children }: Props) {
  // Next 16: cookies()는 async — await 필수
  const store = await cookies()
  const collapsed = store.get('sidebar_collapsed')?.value === '1'
  const navKey = navKeyForRole(user.role)

  return (
    <div className="min-h-screen bg-gray-50 lg:flex">
      <Sidebar
        navKey={navKey}
        role={user.role}
        displayName={user.displayName}
        academyName={academyName}
        initialCollapsed={collapsed}
      />
      <div className="min-w-0 flex-1">
        <MobileNav
          navKey={navKey}
          role={user.role}
          displayName={user.displayName}
          academyName={academyName}
        />
        <main className="mx-auto max-w-6xl p-4 sm:p-6">{children}</main>
      </div>
    </div>
  )
}
