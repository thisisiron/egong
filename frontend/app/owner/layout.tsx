import { AppShell } from '@/components/layout/AppShell'
import { getMyAcademyName } from '@/lib/academy/service'
import { requireRole } from '@/lib/auth'

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  // async-parallel: 인가와 학원명 조회는 독립 — 순차 await(waterfall) 금지.
  // 미인증이면 requireRole의 redirect가 발동하고 학원명 결과는 버려진다 (RLS로 안전).
  const [user, academyName] = await Promise.all([requireRole(['owner']), getMyAcademyName()])
  return (
    <AppShell user={user} academyName={academyName}>
      {children}
    </AppShell>
  )
}
