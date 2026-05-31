import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { listStudents } from '@/lib/students/service'

export default async function StudentsPage() {
  const students = await listStudents()

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">학생</h1>
        <div className="flex gap-2">
          <Link href="/owner/students/import"><Button variant="outline">csv 일괄 등록</Button></Link>
          <Link href="/owner/students/new"><Button>학생 등록</Button></Link>
        </div>
      </div>
      <div className="bg-white border border-amber-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-amber-50 text-left text-slate-700 border-b border-amber-200">
            <tr>
              <th className="px-4 py-3">이름</th>
              <th className="px-4 py-3">학교</th>
              <th className="px-4 py-3">학년</th>
              <th className="px-4 py-3">상태</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-amber-100">
            {students.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  학생이 없습니다.
                </td>
              </tr>
            ) : null}
            {students.map((s) => (
              <tr key={s.id} className="hover:bg-amber-50/50">
                <td className="px-4 py-3 font-medium">{s.name}</td>
                <td className="px-4 py-3">{s.school ?? '-'}</td>
                <td className="px-4 py-3">{s.grade ?? '-'}</td>
                <td className="px-4 py-3">{s.status}</td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/owner/students/${s.id}`} className="text-amber-700 hover:underline">
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
