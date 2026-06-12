import { AppShell } from '@/components/layout/AppShell'
import { getMyAcademyName } from '@/lib/academy/service'
import { requireRole } from '@/lib/auth'

export default async function MeLayout({ children }: { children: React.ReactNode }) {
  // async-parallel — owner layout과 동일한 이유로 병렬
  const [user, academyName] = await Promise.all([
    requireRole(['student', 'parent']),
    getMyAcademyName(),
  ])
  return (
    <AppShell user={user} academyName={academyName}>
      {children}
    </AppShell>
  )
}
