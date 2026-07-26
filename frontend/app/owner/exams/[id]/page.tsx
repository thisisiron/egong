import { ExamDetailBody } from '@/lib/exams/components/ExamDetailBody'

export default async function OwnerExamDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <ExamDetailBody examId={id} basePath="/owner" />
}
