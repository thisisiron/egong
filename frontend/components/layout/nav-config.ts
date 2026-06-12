import {
  Building2,
  FileText,
  GraduationCap,
  Home,
  LayoutDashboard,
  Megaphone,
  School,
  UserRound,
  Users,
  type LucideIcon,
} from 'lucide-react'

import type { UserRole } from '@/lib/auth'

export type NavItem = { href: string; label: string; icon: LucideIcon }
export type NavSection = { label?: string; items: NavItem[] }

/** 역할군별 메뉴. 클라이언트 컴포넌트가 직접 import (아이콘은 직렬화 불가 — prop 전달 금지). */
export const NAV = {
  owner: [
    { items: [{ href: '/owner', label: '대시보드', icon: LayoutDashboard }] },
    {
      label: '학사관리',
      items: [
        { href: '/owner/students', label: '학생', icon: Users },
        { href: '/owner/parents', label: '학부모', icon: UserRound },
        { href: '/owner/teachers', label: '선생님', icon: GraduationCap },
        { href: '/owner/classes', label: '반', icon: School },
      ],
    },
    {
      label: '소통',
      items: [{ href: '/owner/announcements', label: '공지', icon: Megaphone }],
    },
  ],
  teacher: [
    {
      items: [
        { href: '/teacher', label: '내 수업', icon: LayoutDashboard },
        { href: '/teacher/announcements', label: '공지', icon: Megaphone },
      ],
    },
  ],
  admin: [
    {
      items: [
        { href: '/admin', label: '학원', icon: Building2 },
        { href: '/admin/applications', label: '신청서', icon: FileText },
      ],
    },
  ],
  me: [{ items: [{ href: '/me', label: '홈', icon: Home }] }],
} as Record<string, NavSection[]>

export type NavKey = keyof typeof NAV

export function navKeyForRole(role: UserRole): NavKey {
  switch (role) {
    case 'owner':
      return 'owner'
    case 'teacher':
      return 'teacher'
    case 'admin':
      return 'admin'
    case 'student':
    case 'parent':
      return 'me'
  }
}

export const ROLE_LABEL: Record<UserRole, string> = {
  admin: '시스템 관리자',
  owner: '원장',
  teacher: '선생님',
  student: '학생',
  parent: '학부모',
}

/** pathname에 해당하는 활성 메뉴 href — 가장 긴 prefix 매칭 1개만 활성.
 * (예: /owner/students/3 → /owner/students, /teacher/sessions/x → /teacher)
 */
export function activeHref(pathname: string, hrefs: string[]): string | null {
  let best: string | null = null
  for (const href of hrefs) {
    if (pathname === href || pathname.startsWith(href + '/')) {
      if (!best || href.length > best.length) best = href
    }
  }
  return best
}
