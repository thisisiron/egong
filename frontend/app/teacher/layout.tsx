import Link from 'next/link'
import { Logo } from '@/components/Logo'
import { requireRole } from '@/lib/auth'

export default async function TeacherLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireRole(['teacher'])
  return (
    <div className="min-h-screen bg-amber-50">
      <nav className="bg-white border-b border-amber-100">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center text-sm">
          <Logo subtitle="일도수학" />
          <div className="flex items-center gap-1 ml-6">
            <Link href="/teacher" className="px-3 py-1.5 rounded-md text-slate-600 hover:text-slate-900 hover:bg-amber-50">내 수업</Link>
            <Link href="/teacher/announcements" className="px-3 py-1.5 rounded-md text-slate-600 hover:text-slate-900 hover:bg-amber-50">공지</Link>
          </div>
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
