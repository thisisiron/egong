import type { UserRole } from '@/lib/auth'

export type DevAccount = { email: string; label: string }

/** 시드 계정(dev 전용) 화이트리스트. 여기에 없는 role은 로그인 불가. */
export const DEV_ACCOUNTS: Record<UserRole, DevAccount> = {
  owner: { email: 'owner@egong.test', label: '원장' },
  teacher: { email: 'teacher@egong.test', label: '선생' },
  student: { email: 'student@egong.test', label: '학생' },
  parent: { email: 'parent@egong.test', label: '학부모' },
  admin: { email: 'admin@egong.test', label: '운영자' },
}

/** 배너 버튼 표시 순서 — 사용 빈도가 높은 순. */
export const DEV_ROLE_ORDER: UserRole[] = [
  'owner',
  'teacher',
  'student',
  'parent',
  'admin',
]

/**
 * 런타임 화이트리스트 검증.
 * 서버 액션의 인자는 타입만으로 신뢰할 수 없으므로(위조 가능) 문자열로 받아 검사한다.
 */
export function lookupDevAccount(role: string): DevAccount | null {
  if (!DEV_ROLE_ORDER.includes(role as UserRole)) return null
  return DEV_ACCOUNTS[role as UserRole]
}
