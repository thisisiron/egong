import { AppShell } from '@/components/layout/AppShell'
import { requireRole } from '@/lib/auth'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole(['admin'])
  return (
    <AppShell user={user} academyName={null}>
      {children}
    </AppShell>
  )
}
