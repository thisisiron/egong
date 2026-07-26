import { getSessionUser } from '@/lib/auth'
import { ExamReportBoard } from '@/lib/exams/components/ExamReportBoard'
import { getExamReport } from '@/lib/exams/service'
import { getMyChildren } from '@/lib/students/service'
import { ChildSelector } from '../_components/ChildSelector'

export default async function MyExamsPage({
  searchParams,
}: {
  searchParams: Promise<{ child?: string }>
}) {
  const user = await getSessionUser()
  if (!user) return null
  const { child: childParam } = await searchParams

  const children = await getMyChildren()
  const targetStudentId = childParam ?? children[0]?.id ?? null

  if (!targetStudentId) {
    return <div className="text-center text-slate-500 py-12">표시할 학생 정보가 없습니다.</div>
  }

  const rows = await getExamReport(targetStudentId)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-lg font-semibold">성적</h1>
        {user.role === 'parent' && (
          <ChildSelector items={children} current={targetStudentId} basePath="/me/exams" />
        )}
      </div>
      <ExamReportBoard rows={rows} />
    </div>
  )
}
