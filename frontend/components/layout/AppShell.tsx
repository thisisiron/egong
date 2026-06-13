import { cookies } from 'next/headers'

import type { SessionUser } from '@/lib/auth'
import { getUnreadCount, listMyNotifications } from '@/lib/notifications/service'
import type { Notification } from '@/lib/notifications/types'
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

  // 알림 fail-soft — 조회 실패가 셸 전체를 죽이지 않게.
  const [unread, items] = await Promise.all([
    getUnreadCount().catch(() => 0),
    listMyNotifications().catch((): Notification[] => []),
  ])

  return (
    <div className="min-h-screen bg-gray-50 lg:flex">
      <Sidebar
        navKey={navKey}
        role={user.role}
        displayName={user.displayName}
        academyName={academyName}
        initialCollapsed={collapsed}
        notifications={items}
        unreadCount={unread}
      />
      <div className="min-w-0 flex-1">
        <MobileNav
          navKey={navKey}
          role={user.role}
          displayName={user.displayName}
          academyName={academyName}
          notifications={items}
          unreadCount={unread}
        />
        <main className="mx-auto max-w-6xl p-4 sm:p-6">{children}</main>
      </div>
    </div>
  )
}
