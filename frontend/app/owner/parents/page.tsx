import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { formatPhoneKR } from '@/lib/format'
import { listParents } from '@/lib/parents/service'

export default async function ParentsPage() {
  const parents = await listParents()

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">학부모</h1>
        <Link href="/owner/parents/new">
          <Button>학부모 등록</Button>
        </Link>
      </div>
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-slate-700 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3">이름</th>
              <th className="px-4 py-3">이메일</th>
              <th className="px-4 py-3">연락처</th>
              <th className="px-4 py-3">연결된 학생 수</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {parents.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                  등록된 학부모가 없습니다.
                </td>
              </tr>
            ) : null}
            {parents.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50/50">
                <td className="px-4 py-3 font-medium">{p.name}</td>
                <td className="px-4 py-3 text-slate-600">{p.email ?? '-'}</td>
                <td className="px-4 py-3 tabular-nums">{formatPhoneKR(p.phone)}</td>
                <td className="px-4 py-3">{p.linked_student_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500">
        학생 상세 페이지에서 학부모 이메일로 검색해 연결할 수 있습니다.
      </p>
    </div>
  )
}
