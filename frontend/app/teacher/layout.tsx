import Link from 'next/link'
import { requireRole } from '@/lib/auth'

export default async function TeacherLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireRole(['teacher'])
  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center text-sm">
          <Link href="/teacher" className="font-semibold">
            선생님 홈
          </Link>
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
