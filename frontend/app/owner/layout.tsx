import Link from 'next/link'
import { requireRole } from '@/lib/auth'

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  await requireRole(['owner'])
  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-6 text-sm">
          <Link href="/owner" className="font-semibold">원장 대시보드</Link>
          <Link href="/owner/students" className="text-slate-600 hover:text-slate-900">학생</Link>
          <Link href="/owner/teachers" className="text-slate-600 hover:text-slate-900">선생님</Link>
          <Link href="/owner/parents" className="text-slate-600 hover:text-slate-900">학부모</Link>
          <Link href="/owner/classes" className="text-slate-600 hover:text-slate-900">반</Link>
          <div className="flex-1" />
          <form action="/auth/logout" method="post">
            <button className="text-slate-500 hover:text-slate-900">로그아웃</button>
          </form>
        </div>
      </nav>
      <main className="max-w-6xl mx-auto p-6">{children}</main>
    </div>
  )
}
