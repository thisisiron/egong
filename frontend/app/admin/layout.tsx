import { Logo } from '@/components/Logo'
import { requireRole } from '@/lib/auth'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireRole(['admin'])
  return (
    <div className="min-h-screen bg-amber-50">
      <nav className="bg-white border-b border-amber-100">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-6 text-sm">
          <Logo subtitle="시스템 관리자" />
          <div className="flex-1" />
          <form action="/auth/logout" method="post">
            <button className="text-slate-500 hover:text-slate-900">로그아웃</button>
          </form>
        </div>
      </nav>
      <main className="max-w-6xl mx-auto p-4 sm:p-6">{children}</main>
    </div>
  )
}
