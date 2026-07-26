import { ExamsPageBody } from '@/lib/exams/components/ExamsPageBody'

export default async function OwnerExamsPage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string }>
}) {
  const { class: classId } = await searchParams
  return <ExamsPageBody basePath="/owner" classId={classId} />
}
