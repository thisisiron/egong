import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'

export default async function StudentsPage() {
  const supabase = await createClient()
  const { data: students } = await supabase
    .from('students')
    .select('id, name, school, grade, status')
    .order('name')

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">학생</h1>
        <div className="flex gap-2">
          <Link href="/owner/students/new"><Button>학생 등록</Button></Link>
        </div>
      </div>
      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3">이름</th>
              <th className="px-4 py-3">학교</th>
              <th className="px-4 py-3">학년</th>
              <th className="px-4 py-3">상태</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {(!students || students.length === 0) ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  학생이 없습니다.
                </td>
              </tr>
            ) : null}
            {(students ?? []).map((s) => (
              <tr key={s.id} className="border-t">
                <td className="px-4 py-3 font-medium">{s.name}</td>
                <td className="px-4 py-3">{s.school ?? '-'}</td>
                <td className="px-4 py-3">{s.grade ?? '-'}</td>
                <td className="px-4 py-3">{s.status}</td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/owner/students/${s.id}`} className="text-blue-600 hover:underline">
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
