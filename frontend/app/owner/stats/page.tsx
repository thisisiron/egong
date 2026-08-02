import { StatsPageBody } from '@/lib/stats/components/StatsPageBody'

export default async function OwnerStatsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  return <StatsPageBody basePath="/owner" roleLabel="원장" searchParams={await searchParams} />
}
