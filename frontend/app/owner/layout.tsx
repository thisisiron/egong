import Link from 'next/link'
import { Logo } from '@/components/Logo'
import { requireRole } from '@/lib/auth'

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  await requireRole(['owner'])
  return (
    <div className="min-h-screen bg-amber-50">
      <nav className="bg-white border-b border-amber-100">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-1 sm:gap-4 text-sm">
          <Logo subtitle="일도수학" />
          <div className="flex items-center gap-1 ml-2 sm:ml-6">
            <Link href="/owner" className="px-3 py-1.5 rounded-md text-slate-600 hover:text-slate-900 hover:bg-amber-50">대시보드</Link>
            <Link href="/owner/students" className="px-3 py-1.5 rounded-md text-slate-600 hover:text-slate-900 hover:bg-amber-50">학생</Link>
            <Link href="/owner/teachers" className="px-3 py-1.5 rounded-md text-slate-600 hover:text-slate-900 hover:bg-amber-50">선생님</Link>
            <Link href="/owner/parents" className="px-3 py-1.5 rounded-md text-slate-600 hover:text-slate-900 hover:bg-amber-50">학부모</Link>
            <Link href="/owner/classes" className="px-3 py-1.5 rounded-md text-slate-600 hover:text-slate-900 hover:bg-amber-50">반</Link>
            <Link href="/owner/announcements" className="px-3 py-1.5 rounded-md text-slate-600 hover:text-slate-900 hover:bg-amber-50">공지</Link>
          </div>
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
