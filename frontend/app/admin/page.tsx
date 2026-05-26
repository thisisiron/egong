import Link from 'next/link'
import { apiFetch } from '@/lib/api/client'
import { requireRole } from '@/lib/auth'
import { Button } from '@/components/ui/button'

type Academy = {
  id: string
  name: string
  status: string
  contract_started_at: string | null
  created_at: string
}

export default async function AdminDashboard() {
  await requireRole(['admin'])
  const academies = await apiFetch<Academy[]>('/admin/academies')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">학원 관리</h1>
        <Link href="/admin/academies/new">
          <Button>새 학원 생성</Button>
        </Link>
      </div>
      <div className="bg-white border border-amber-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-amber-50 text-left text-slate-700 border-b border-amber-200">
            <tr>
              <th className="px-4 py-3">학원명</th>
              <th className="px-4 py-3">상태</th>
              <th className="px-4 py-3">납품 시작일</th>
              <th className="px-4 py-3">생성일</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-amber-100">
            {academies.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  학원이 없습니다.
                </td>
              </tr>
            ) : null}
            {academies.map((a) => (
              <tr key={a.id} className="hover:bg-amber-50/50">
                <td className="px-4 py-3 font-medium">{a.name}</td>
                <td className="px-4 py-3">{a.status}</td>
                <td className="px-4 py-3">{a.contract_started_at ?? '-'}</td>
                <td className="px-4 py-3 text-slate-500">
                  {new Date(a.created_at).toLocaleDateString('ko-KR')}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/admin/academies/${a.id}`}
                    className="text-amber-700 hover:underline"
                  >
                    상세
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
