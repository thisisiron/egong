import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  addParentLinkAction,
  removeParentLinkAction,
  updateStudentAction,
} from './actions'
import { ChildAssignment } from './_components/ChildAssignment'

type ParentLinkRow = {
  relationship: string
  parents: { id: string; name: string; phone: string | null } | null
}

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const [studentRes, parentLinksRes] = await Promise.all([
    supabase.from('students').select('*').eq('id', id).single(),
    supabase
      .from('student_parent')
      .select('relationship, parents(id, name, phone)')
      .eq('student_id', id),
  ])

  const student = studentRes.data
  if (!student) notFound()

  const parentLinks = (parentLinksRes.data ?? []) as unknown as ParentLinkRow[]

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-semibold">{student.name}</h1>

      <section className="bg-white border rounded-lg p-6 space-y-3">
        <h2 className="font-semibold">기본 정보</h2>
        <form action={updateStudentAction} className="space-y-3">
          <input type="hidden" name="id" value={student.id} />
          <div className="space-y-1">
            <Label htmlFor="name">이름</Label>
            <Input id="name" name="name" defaultValue={student.name} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="school">학교</Label>
            <Input id="school" name="school" defaultValue={student.school ?? ''} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="grade">학년</Label>
            <Input id="grade" name="grade" defaultValue={student.grade ?? ''} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="status">상태</Label>
            <select
              id="status"
              name="status"
              defaultValue={student.status}
              className="w-full border rounded px-3 py-2 text-sm"
            >
              <option value="enrolled">재원</option>
              <option value="paused">휴원</option>
              <option value="graduated">종강</option>
            </select>
          </div>
          <Button type="submit">저장</Button>
        </form>
      </section>

      <section className="bg-white border rounded-lg p-6 space-y-3">
        <h2 className="font-semibold">학부모 연결</h2>
        <ul className="space-y-2">
          {parentLinks.length === 0 ? (
            <li className="text-sm text-slate-400">연결된 학부모가 없습니다.</li>
          ) : null}
          {parentLinks.map((link) =>
            link.parents ? (
              <li
                key={link.parents.id}
                className="flex items-center justify-between border rounded p-3"
              >
                <div>
                  <div className="font-medium">
                    {link.parents.name} ({link.relationship})
                  </div>
                  <div className="text-xs text-slate-500">{link.parents.phone ?? ''}</div>
                </div>
                <form action={removeParentLinkAction}>
                  <input type="hidden" name="student_id" value={student.id} />
                  <input type="hidden" name="parent_id" value={link.parents.id} />
                  <button className="text-sm text-red-600 hover:underline">
                    연결 해제
                  </button>
                </form>
              </li>
            ) : null
          )}
        </ul>
        <form
          action={addParentLinkAction}
          className="flex items-end gap-2 pt-2 border-t"
        >
          <input type="hidden" name="student_id" value={student.id} />
          <div className="flex-1 space-y-1">
            <Label htmlFor="parent_email">학부모 이메일</Label>
            <Input
              id="parent_email"
              name="parent_email"
              type="email"
              placeholder="등록된 학부모 계정 이메일"
              required
            />
          </div>
          <select
            name="relationship"
            defaultValue="mother"
            className="border rounded px-3 py-2 text-sm"
          >
            <option value="mother">모</option>
            <option value="father">부</option>
            <option value="other">기타</option>
          </select>
          <Button type="submit">연결</Button>
        </form>
      </section>

      <ChildAssignment studentId={student.id} />
    </div>
  )
}
