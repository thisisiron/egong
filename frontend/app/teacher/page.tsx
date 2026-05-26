import { SessionCalendar } from './_components/SessionCalendar'

type SearchParams = {
  view?: string
  ym?: string
  y?: string
  day?: string
}

export default async function TeacherDashboard({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const sp = await searchParams
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">내 수업</h1>
      <SessionCalendar searchParams={sp} />
    </div>
  )
}
