import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { formatPhoneKR } from '@/lib/format'

type TeacherRow = {
  id: string
  users: {
    display_name: string
    phone: string | null
    email: string | null
  } | null
}

export default async function TeachersPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('teachers')
    .select('id, users(display_name, phone, email)')
    .order('id')

  const teachers = (data ?? []) as unknown as TeacherRow[]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">선생님</h1>
        <Link href="/owner/teachers/new">
          <Button>선생님 등록</Button>
        </Link>
      </div>
      <div className="bg-white border border-amber-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-amber-50 text-left text-slate-700 border-b border-amber-200">
            <tr>
              <th className="px-4 py-3">이름</th>
              <th className="px-4 py-3">이메일</th>
              <th className="px-4 py-3">연락처</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-amber-100">
            {teachers.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-slate-400">
                  선생님이 없습니다.
                </td>
              </tr>
            ) : null}
            {teachers.map((t) => (
              <tr key={t.id} className="hover:bg-amber-50/50">
                <td className="px-4 py-3 font-medium">{t.users?.display_name ?? '-'}</td>
                <td className="px-4 py-3 text-slate-600">{t.users?.email ?? '-'}</td>
                <td className="px-4 py-3 tabular-nums">{formatPhoneKR(t.users?.phone)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
