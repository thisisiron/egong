import { StatsPageBody } from '@/lib/stats/components/StatsPageBody'

export default async function TeacherStatsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  return (
    <StatsPageBody basePath="/teacher" roleLabel="선생님" searchParams={await searchParams} />
  )
}
