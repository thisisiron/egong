import { Logo } from '@/components/Logo'
import { requireRole } from '@/lib/auth'

export default async function MeLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireRole(['student', 'parent'])
  return (
    <div className="min-h-screen bg-amber-50">
      <nav className="bg-white border-b border-amber-100">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center text-sm">
          <Logo subtitle="내 학습" />
          <div className="flex-1" />
          <form action="/auth/logout" method="post">
            <button className="text-slate-500 hover:text-slate-900">로그아웃</button>
          </form>
        </div>
      </nav>
      <main className="max-w-4xl mx-auto p-4 sm:p-6">{children}</main>
    </div>
  )
}
