import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { formatPhoneKR } from '@/lib/format'

type ParentRow = {
  id: string
  name: string
  phone: string | null
  users: { email: string | null } | null
  student_parent: { student_id: string }[]
}

export default async function ParentsPage() {
  const supabase = await createClient()
  // RLS limits visible parents to those linked to a student in this academy
  // (parents_owner_all policy in supabase/migrations/...rls_policies.sql),
  // so a plain select shows the right set without an explicit filter.
  const { data } = await supabase
    .from('parents')
    .select('id, name, phone, users(email), student_parent(student_id)')
    .order('name')

  const parents = (data ?? []) as unknown as ParentRow[]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">학부모</h1>
        <Link href="/owner/parents/new">
          <Button>학부모 등록</Button>
        </Link>
      </div>
      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3">이름</th>
              <th className="px-4 py-3">이메일</th>
              <th className="px-4 py-3">연락처</th>
              <th className="px-4 py-3">연결된 학생 수</th>
            </tr>
          </thead>
          <tbody>
            {parents.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                  등록된 학부모가 없습니다.
                </td>
              </tr>
            ) : null}
            {parents.map((p) => {
              const user = Array.isArray(p.users) ? p.users[0] : p.users
              return (
                <tr key={p.id} className="border-t">
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3 text-slate-600">{user?.email ?? '-'}</td>
                  <td className="px-4 py-3 tabular-nums">{formatPhoneKR(p.phone)}</td>
                  <td className="px-4 py-3">{p.student_parent?.length ?? 0}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500">
        학생 상세 페이지에서 학부모 이메일로 검색해 연결할 수 있습니다.
      </p>
    </div>
  )
}
