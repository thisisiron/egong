import { ExamsPageBody } from '@/lib/exams/components/ExamsPageBody'

export default async function TeacherExamsPage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string }>
}) {
  const { class: classId } = await searchParams
  return <ExamsPageBody basePath="/teacher" classId={classId} />
}
