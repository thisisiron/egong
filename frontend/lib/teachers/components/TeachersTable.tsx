import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { formatPhoneKR } from '@/lib/format'
import type { TeacherRow } from '@/lib/teachers/types'

export function TeachersTable({ teachers, basePath }: { teachers: TeacherRow[]; basePath: string }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">선생님</h1>
        <Link href={`${basePath}/teachers/new`}>
          <Button>선생님 등록</Button>
        </Link>
      </div>
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-slate-700 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3">이름</th>
              <th className="px-4 py-3">이메일</th>
              <th className="px-4 py-3">연락처</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {teachers.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-slate-400">
                  선생님이 없습니다.
                </td>
              </tr>
            ) : null}
            {teachers.map((t) => (
              <tr key={t.id} className="hover:bg-gray-50/50">
                <td className="px-4 py-3 font-medium">{t.display_name}</td>
                <td className="px-4 py-3 text-slate-600">{t.email ?? '-'}</td>
                <td className="px-4 py-3 tabular-nums">{formatPhoneKR(t.phone)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
