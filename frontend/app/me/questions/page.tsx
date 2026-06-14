import { getSessionUser } from '@/lib/auth'
import { getMyChildren } from '@/lib/students/service'
import { listQuestionsForStudent, getMyEnrolledClasses } from '@/lib/questions/service'
import { QuestionList } from '@/lib/questions/components/QuestionList'
import { QuestionForm } from '@/lib/questions/components/QuestionForm'
import { ChildSelector } from '../_components/ChildSelector'

export default async function MyQuestionsPage({ searchParams }: { searchParams: Promise<{ child?: string }> }) {
  const user = await getSessionUser()
  if (!user) return null
  const { child } = await searchParams
  const children = await getMyChildren()
  const studentId = child ?? children[0]?.id ?? null
  if (!studentId) return <div className="text-center text-slate-500 py-12">표시할 학생 정보가 없습니다.</div>

  const questions = await listQuestionsForStudent(studentId)
  const isStudent = user.role === 'student'
  const classOptions = isStudent ? await getMyEnrolledClasses(studentId) : []
  const academyId = user.academyId ?? questions[0]?.academy_id ?? null

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">질문</h1>
        {user.role === 'parent' && <ChildSelector items={children} current={studentId} basePath="/me/questions" />}
      </header>

      {isStudent && classOptions.length > 0 && academyId && (
        <section className="bg-white border border-gray-200 rounded-lg p-5 space-y-3">
          <h2 className="font-semibold">질문하기</h2>
          <QuestionForm classOptions={classOptions} academyId={academyId} />
        </section>
      )}

      <section className="space-y-2">
        <h2 className="font-semibold text-sm">받은/올린 질문</h2>
        <QuestionList questions={questions} basePath="/me/questions" />
      </section>
    </div>
  )
}
